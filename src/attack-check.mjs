import { createHmac, randomBytes, randomUUID } from 'node:crypto';

// 3단계 자기 점검: 배포된 주소에 실제로 요청을 보내고, 받은 상태 코드만 기록합니다.
// 심판의 판정이 아닙니다. 토큰·키·메모 본문은 결과에 넣지 않습니다.
// 위조 토큰은 매번 새로 만든 무작위 키로 서명한 가짜이며, 아무 비밀값도 쓰지 않습니다.
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function forgedToken(issuer) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iss: issuer, aud: 'authenticated', role: 'authenticated',
    sub: randomUUID(), iat: now, exp: now + 3600 });
  const signature = createHmac('sha256', randomBytes(32)).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

export async function runAttackChecks(config) {
  if (config.step !== 3) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  const issuer = config.identityProvider?.issuer;
  if (typeof issuer !== 'string' || !issuer) throw new Error('aleph.config.json의 identityProvider를 먼저 넣어 주세요.');

  const send = (path, { method = 'GET', token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(new URL(path, app), {
      method, headers, body, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
  };
  const verdict = (response) => (response.status === 401
    ? `HTTP 401, 자료 없이 거부됨` : `HTTP ${response.status}, 거부되지 않음`);

  const attempts = [];

  // 1단계 점검: 옛 공개 파일이 현재 배포에 없어야 합니다.
  const data = await send('/data.json');
  let visible = false;
  if (data.ok) {
    try {
      const json = await data.json();
      visible = json?.sampleMarker === config.sampleMarker && Array.isArray(json.notes) && json.notes.length > 0;
    } catch {
      // 자료가 아닌 응답은 공개로 보지 않습니다.
    }
  }
  attempts.push({ attackId: 'anonymous_data_json', expected: '비로그인 /data.json에서 가상 메모 확인 표시가 보이지 않음',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임'
      : `확인 표시가 보이지 않음 (HTTP ${data.status})` });

  const anonymous = [
    ['anonymous_notes_read', '로그인 없이 가상 메모 API를 읽으면 401', '/api/notes', {}],
    ['anonymous_memo_list', '로그인 없이 메모 목록을 읽으면 401', '/api/memos', {}],
    // 본문을 일부러 비워 보내서, 거부되지 않더라도 메모가 만들어지지 않게 합니다.
    ['anonymous_memo_create', '로그인 없이 메모를 추가하면 401', '/api/memos', { method: 'POST', body: '{}' }],
    ['anonymous_memo_update', '로그인 없이 메모를 고치면 401', `/api/memos/${randomUUID()}`, { method: 'PUT', body: '{}' }],
    ['anonymous_memo_delete', '로그인 없이 메모를 지우면 401', `/api/memos/${randomUUID()}`, { method: 'DELETE' }],
  ];
  for (const [attackId, expected, path, options] of anonymous) {
    attempts.push({ attackId, expected, observed: verdict(await send(path, options)) });
  }

  const forged = [
    ['forged_token_notes', '위조 토큰으로 가상 메모 API를 읽으면 401', '/api/notes'],
    ['forged_token_memo_list', '위조 토큰으로 메모 목록을 읽으면 401', '/api/memos'],
  ];
  for (const [attackId, expected, path] of forged) {
    attempts.push({ attackId, expected, observed: verdict(await send(path, { token: forgedToken(issuer) })) });
  }
  return attempts;
}
