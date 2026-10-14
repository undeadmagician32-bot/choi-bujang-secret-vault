import { randomUUID } from 'node:crypto';
import { decide } from './decider.mjs';
import { detect } from './detect.mjs';
import { forgedToken, PUBLISHABLE_KEY } from './attack-check.mjs';

// 12단계 제작 2: 1~11단계의 정상·금지 요청을 한 표로 모읍니다.
// 상태 규칙: 요청을 실제로 보내(또는 함수를 실제로 불러) 받은 결과가 기대와 같을 때만 '통과'입니다.
//   다르면 '실패', 보내지 못했으면 '오류', 필요한 준비(로그인 토큰·기기 쿠키 등)가 없거나 쓰기 허용을 안 했으면 '미실행'입니다.
//   미실행 항목은 어떤 경우에도 통과로 세지 않고, 실제 결과·요청 ID·확인 시각을 비워 둡니다.
// 근거 구분: 'deploy'=배포 주소로 보낸 실제 요청, 'local'=이 컴퓨터에서 함수를 직접 부른 가상 요청(심판 판정이 아님).
// 요청 ID: 배포 응답은 Vercel 머리글 x-vercel-id, 로컬 판정기 호출은 요청에 넣은 requestId입니다. 없으면 null입니다.
// 토큰·쿠키·메모 id는 환경변수로만 받고 표·로그·결과 파일에 쓰지 않습니다. 응답 본문은 저장하지 않으며 고정 오류 코드만 남깁니다.
export const ATTACK_TOTAL = 41; // 총공세 종류 수(제작 안내 기준). 종류 목록은 이 저장소에 없어 이 표와 연결하지 않습니다.
export const ENV_NAMES = Object.freeze(['VAULT_TOKEN_A', 'VAULT_TOKEN_B', 'VAULT_DEVICE_COOKIE_A', 'VAULT_DEVICE_COOKIE_B',
  'VAULT_A_MEMO_ID', 'VAULT_B_RESTORE_ID']);

const KNOWN_MEMO_ID = 'b0b0b0b0-0000-4000-8000-000000000001'; // 공개 가능한 B의 시험 메모 id(attack-check와 같은 값)
const SAFE_VALUE = /^[A-Za-z0-9._~-]{8,4096}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const KEY_PATTERN = /sb_publishable_|eyJ[A-Za-z0-9_-]{10,}\.eyJ/u;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,40}$/u;

// ---------- 배포 점검 목록 ----------
// auth: none | forged | A | B(+ cookie: true면 해당 계정의 기기 쿠키도 붙임) / needs: 필요한 환경변수 / write: --include-writes 필요
const D = (id, step, kind, method, path, expectStatus, extra = {}) => ({
  id, step, kind, evidence: 'deploy', method, path, expectStatus, auth: 'none', needs: [], write: false, ...extra });

const DEPLOY_CHECKS = [
  D('s01_home', 1, '정상', 'GET', '/', [200], { describe: '로그인 없이 첫 화면을 엶' }),
  D('s01_data_json', 1, '금지', 'GET', '/data.json', [404], { describe: '옛 공개 파일 /data.json은 없어야 함' }),
  D('s02_notes_anon', 2, '금지', 'GET', '/api/notes', [401], { describe: '로그인 없이 가상 메모 API 읽기' }),
  D('s03_memo_list_anon', 3, '금지', 'GET', '/api/memos', [401], { describe: '로그인 없이 메모 목록' }),
  D('s03_memo_create_anon', 3, '금지', 'POST', '/api/memos', [401], { body: '{}', describe: '로그인 없이 메모 추가(빈 본문)' }),
  D('s03_memo_update_anon', 3, '금지', 'PUT', '/api/memos/{RANDOM}', [401], { body: '{}', describe: '로그인 없이 메모 수정' }),
  D('s03_memo_delete_anon', 3, '금지', 'DELETE', '/api/memos/{RANDOM}', [401], { describe: '로그인 없이 메모 삭제' }),
  D('s03_memo_read_known_anon', 3, '금지', 'GET', `/api/memos/${KNOWN_MEMO_ID}`, [401], { describe: '로그인 없이 알려진 id로 읽기' }),
  D('s03_forged_notes', 3, '금지', 'GET', '/api/notes', [401], { auth: 'forged', describe: '위조 토큰으로 가상 메모 읽기' }),
  D('s03_forged_memos', 3, '금지', 'GET', '/api/memos', [401], { auth: 'forged', describe: '위조 토큰으로 메모 목록' }),
  D('s03_a_list', 3, '정상', 'GET', '/api/memos', [200], { auth: 'A', cookie: true, needs: ['VAULT_TOKEN_A', 'VAULT_DEVICE_COOKIE_A'],
    describe: 'A가 승인된 기기에서 자기 메모 목록 읽기' }),
  D('s04_owner_change_anon', 4, '금지', 'PUT', '/api/memos/{RANDOM}', [401], {
    body: '{"title":"x","body":"y","owner_id":"{RANDOM}"}', describe: '로그인 없이 owner_id를 넣어 수정' }),
  D('s04_a_read_own', 4, '정상', 'GET', '/api/memos/{A_MEMO}', [200], { auth: 'A', cookie: true,
    needs: ['VAULT_TOKEN_A', 'VAULT_DEVICE_COOKIE_A', 'VAULT_A_MEMO_ID'], describe: 'A가 자기 메모 한 건 읽기' }),
  D('s04_b_read_a', 4, '금지', 'GET', '/api/memos/{A_MEMO}', [404], { auth: 'B', cookie: true,
    needs: ['VAULT_TOKEN_B', 'VAULT_DEVICE_COOKIE_B', 'VAULT_A_MEMO_ID'], describe: 'B가 A의 메모 id로 읽기' }),
  D('s05_direct_original_anon', 5, '금지', 'GET', '{ORIGINAL}', [401, 403], { auth: 'publishable', describe: '공개 키만으로 원본 자료 API 직접 요청' }),
  D('s05_home_no_key', 5, '금지', 'GET', '/', [200], { check: 'no_key', describe: '첫 화면 코드에 Supabase 공개 키가 없어야 함' }),
  D('s05_home_nosniff', 5, '정상', 'GET', '/', [200], { check: 'nosniff', describe: '첫 화면 응답에 X-Content-Type-Options: nosniff' }),
  D('s05_aleph_json', 5, '정상', 'GET', '/aleph.json', [200], { check: 'aleph', describe: '/aleph.json에 allowedRoutes·originalApiUrl이 실림' }),
  D('s10_restore_anon', 10, '금지', 'POST', '/api/memo-restore/{RANDOM}', [401], { body: '{}', describe: '로그인 없이 사본 복원' }),
  D('s10_restore_b_own', 10, '정상', 'POST', '/api/memo-restore/{B_RESTORE}', [200], { auth: 'B', cookie: true, write: true,
    body: '{}', needs: ['VAULT_TOKEN_B', 'VAULT_DEVICE_COOKIE_B', 'VAULT_B_RESTORE_ID'], describe: 'B가 자기 사본 한 건 복원(메모·감사 기록을 씀)' }),
  D('s10_restore_a_takes_b', 10, '금지', 'POST', '/api/memo-restore/{B_RESTORE}', [404], { auth: 'A', cookie: true, write: true,
    body: '{}', needs: ['VAULT_TOKEN_A', 'VAULT_DEVICE_COOKIE_A', 'VAULT_B_RESTORE_ID'], describe: 'A가 B의 사본 id로 복원(감사 기록만 씀)' }),
  D('s11_device_status_anon', 11, '금지', 'GET', '/api/device', [401], { describe: '로그인 없이 기기 상태 조회' }),
  D('s11_device_request_anon', 11, '금지', 'POST', '/api/device', [401], { body: '{}', describe: '로그인 없이 기기 승인 요청' }),
  D('s11_manifest', 11, '정상', 'GET', '/manifest.webmanifest', [200], { describe: '설치형 앱 설정 파일' }),
  D('s11_sw', 11, '정상', 'GET', '/sw.js', [200], { describe: '안내 전용 서비스 워커' }),
  D('s11_offline', 11, '정상', 'GET', '/offline.html', [200], { describe: '오프라인 안내 페이지' }),
  D('s11_a_device_status', 11, '정상', 'GET', '/api/device', [200], { auth: 'A', needs: ['VAULT_TOKEN_A'],
    describe: 'A가 로그인한 채 기기 상태 조회(쿠키 없이)' }),
  D('s11_a_memos_no_cookie', 11, '금지', 'GET', '/api/memos', [403], { auth: 'A', needs: ['VAULT_TOKEN_A'], errorCode: 'DEVICE_NOT_APPROVED',
    describe: '로그인했지만 기기 쿠키 없이 메모 목록' }),
  D('s11_a_notes_no_cookie', 11, '금지', 'GET', '/api/notes', [403], { auth: 'A', needs: ['VAULT_TOKEN_A'], errorCode: 'DEVICE_NOT_APPROVED',
    describe: '로그인했지만 기기 쿠키 없이 가상 메모 읽기' }),
];

// ---------- 로컬 점검 목록(6·7·8·9단계: 판정기·탐지 함수에 가상 요청) ----------
const sha = '0'.repeat(64);
const decideRequest = (over = {}) => ({
  schema: 'aleph.decision.v1', requestId: randomUUID(), classId: 'class_fixture', projectId: 'project_fixture',
  subjectId: 'learner_fixture', deviceId: 'a'.repeat(16), service: 'notes', method: 'GET', path: '/notes/demo',
  route: 'GET /notes/:id', queryLength: 0, querySha256: sha, at: new Date().toISOString(), policyRevision: 1,
  deviceRegistered: true, stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
  signals: { source: 'judge_fixture', region: 'local', network: 'usual', hour: 14 }, ...over });
const burst = { signals: { source: 'judge_fixture', region: 'foreign', network: 'unusual', hour: 3 },
  recentEvents: [{ kind: 'risk_signal', ageSeconds: 60, count: 20 }] };

const L = (id, step, kind, describe, expected, run) => ({ id, step, kind, evidence: 'local', describe, expected, run });
const decideCheck = (id, step, kind, describe, over, decision, reasonCode) => L(id, step, kind, describe,
  reasonCode ? `${decision} (${reasonCode})` : decision, async () => {
    const request = decideRequest(over);
    const result = await decide(request);
    const actual = `${result?.decision} (${result?.reasonCode})`;
    const passed = result?.requestId === request.requestId && result.decision === decision
      && (!reasonCode || result.reasonCode === reasonCode);
    return { passed, actual, requestId: request.requestId };
  });
const events = (count, start = Date.UTC(2026, 9, 1), gapMs = 1000, sub = 'learner_fixture') =>
  Array.from({ length: count }, (_, i) => ({ at: new Date(start + i * gapMs).toISOString(), method: 'GET', identity: { sub } }));
const detectCheck = (id, kind, describe, count, expected) => L(id, 9, kind, describe, expected, async () => {
  const result = detect(events(count));
  return { passed: result.action === expected, actual: result.action, requestId: null };
});

const LOCAL_CHECKS = [
  decideCheck('s06_registered_allow', 6, '정상', '등록 기기의 메모 읽기', {}, 'allow', 'approved'),
  decideCheck('s06_unregistered_deny', 6, '금지', '미등록 기기의 같은 요청', { deviceRegistered: false }, 'deny', 'device_not_registered'),
  decideCheck('s07_burst_step_up', 7, '금지', '0~5시 + 처음 보는 네트워크 + 짧은 시간 많은 읽기', burst, 'step_up', 'step_up_required'),
  decideCheck('s07_reverified_allow', 7, '정상', '같은 이상 접속을 최근에 다시 확인함', { ...burst, stepUp: { verified: true, authAgeSeconds: 60 } }, 'allow'),
  decideCheck('s08_memo_read_allow', 8, '정상', '메모 읽기(GET /notes/:id)', {}, 'allow', 'approved'),
  decideCheck('s08_memo_update_allow', 8, '정상', '메모 수정(PUT /notes/:id)', { method: 'PUT', route: 'PUT /notes/:id' }, 'allow', 'approved'),
  decideCheck('s08_notice_write_deny', 8, '금지', '학생 신분의 공지 수정(PUT /notices/:id)',
    { service: 'notices', method: 'PUT', path: '/notices/n1', route: 'PUT /notices/:id' }, 'deny', 'instructor_not_verified'),
  decideCheck('s08_query_deny', 8, '금지', '쿼리가 붙은 요청', { queryLength: 5 }, 'deny', 'route_not_allowed'),
  decideCheck('s08_export_deny', 8, '금지', '구역 표에 없는 /notes/:id/export', { path: '/notes/demo/export' }, 'deny', 'route_not_allowed'),
  decideCheck('s08_delete_deny', 8, '금지', '구역 표에 없는 DELETE', { method: 'DELETE', route: 'DELETE /notes/:id' }, 'deny', 'route_not_allowed'),
  detectCheck('s09_detect_30_observe', '정상', '같은 사용자의 조회 30건', 30, 'observe'),
  detectCheck('s09_detect_120_observe', '정상', '같은 사용자의 조회 정확히 120건(경계)', 120, 'observe'),
  detectCheck('s09_detect_121_revoke', '금지', '같은 사용자의 10분 안 조회 121건', 121, 'propose_revocation'),
];

export const CHECKS = Object.freeze([...DEPLOY_CHECKS, ...LOCAL_CHECKS].sort((a, b) => a.step - b.step));

// ---------- 실행 ----------
const stamp = (now) => now().toISOString();
const skipped = (check, reason) => ({ ...describeRow(check), actual: '-', requestId: null, checkedAt: null, status: '미실행', reason });
function describeRow(check) {
  const request = check.evidence === 'deploy'
    ? `${check.method} ${check.path.replace('{ORIGINAL}', '원본 자료 API').replace('{RANDOM}', ':임의id')
      .replace('{A_MEMO}', ':A메모id').replace('{B_RESTORE}', ':B사본id')} (${{ none: '로그인 없음', forged: '위조 토큰', A: 'A 로그인', B: 'B 로그인', publishable: '공개 키만' }[check.auth]}${check.cookie ? ' + 기기 쿠키' : ''})`
    : `로컬 함수 호출 · ${check.describe}`;
  const expected = check.evidence === 'deploy'
    ? `HTTP ${check.expectStatus.join(' 또는 ')}${check.errorCode ? ` ${check.errorCode}` : ''}${check.check ? ` · ${check.describe}` : ''}`
    : check.expected;
  return { id: check.id, step: check.step, kind: check.kind, evidence: check.evidence === 'deploy' ? '배포' : '로컬',
    what: check.describe, request, expected };
}

function buildUrl(check, ctx, env) {
  const swaps = { '{RANDOM}': randomUUID(), '{A_MEMO}': env.VAULT_A_MEMO_ID, '{B_RESTORE}': env.VAULT_B_RESTORE_ID };
  let path = check.path;
  for (const [token, value] of Object.entries(swaps)) path = path.replaceAll(token, value ?? '');
  return path === '{ORIGINAL}' ? ctx.original : new URL(path, ctx.app);
}

function headersFor(check, ctx, env) {
  const headers = {};
  if (check.body !== undefined) headers['Content-Type'] = 'application/json';
  if (check.auth === 'forged') headers.Authorization = `Bearer ${forgedToken(ctx.issuer)}`;
  if (check.auth === 'A') headers.Authorization = `Bearer ${env.VAULT_TOKEN_A}`;
  if (check.auth === 'B') headers.Authorization = `Bearer ${env.VAULT_TOKEN_B}`;
  if (check.auth === 'publishable') headers.apikey = PUBLISHABLE_KEY;
  if (check.cookie) headers.Cookie = `vault_device=${check.auth === 'A' ? env.VAULT_DEVICE_COOKIE_A : env.VAULT_DEVICE_COOKIE_B}`;
  return headers;
}

const bodyFor = (check, env) => (check.body === undefined ? undefined
  : check.body.replaceAll('{RANDOM}', randomUUID()));

function contentFailure(check, response, text) {
  if (check.check === 'no_key') return KEY_PATTERN.test(text) ? '키로 보이는 문자열이 있음' : null;
  if (check.check === 'nosniff') return response.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff' ? null : 'nosniff 머리글 없음';
  if (check.check === 'aleph') {
    try {
      const json = JSON.parse(text);
      return Array.isArray(json.allowedRoutes) && json.allowedRoutes.length && typeof json.originalApiUrl === 'string'
        ? null : 'allowedRoutes 또는 originalApiUrl 없음';
    } catch { return 'JSON이 아님'; }
  }
  return null;
}

async function runDeploy(check, ctx, env) {
  const row = describeRow(check);
  const checkedAt = stamp(ctx.now);
  try {
    const response = await ctx.fetch(buildUrl(check, ctx, env), {
      method: check.method, headers: headersFor(check, ctx, env), body: bodyFor(check, env),
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let code = null;
    try { const value = JSON.parse(text)?.error; if (typeof value === 'string' && ERROR_CODE.test(value)) code = value; } catch { /* 본문은 저장하지 않습니다 */ }
    const statusOk = check.expectStatus.includes(response.status);
    const codeOk = !check.errorCode || code === check.errorCode;
    const failure = statusOk && codeOk ? contentFailure(check, response, text) : null;
    const requestId = response.headers.get('x-vercel-id') ?? null;
    return { ...row, actual: `HTTP ${response.status}${code ? ` ${code}` : ''}${failure ? ` · ${failure}` : ''}`, requestId, checkedAt,
      status: statusOk && codeOk && !failure ? '통과' : '실패' };
  } catch {
    return { ...row, actual: '요청을 보내지 못함', requestId: null, checkedAt, status: '오류' };
  }
}

async function runLocal(check, ctx) {
  const row = describeRow(check);
  const checkedAt = stamp(ctx.now);
  try {
    const result = await check.run();
    return { ...row, actual: result.actual, requestId: result.requestId, checkedAt, status: result.passed ? '통과' : '실패' };
  } catch {
    return { ...row, actual: '함수 호출 중 오류', requestId: null, checkedAt, status: '오류' };
  }
}

function validateConfig(config) {
  const app = new URL(config.publicAppUrl);
  const original = new URL(config.originalApiUrl);
  for (const url of [app, original]) {
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('배포 주소와 원본 자료 API 주소는 쿼리 없는 HTTPS 주소여야 합니다.');
  }
  const issuer = config.identityProvider?.issuer;
  if (typeof issuer !== 'string' || !issuer) throw new Error('aleph.config.json의 identityProvider를 먼저 넣어 주세요.');
  return { app, original, issuer };
}

// env에서 값을 읽되 형식이 안전하지 않으면 없는 것으로 봅니다(머리글 주입 방지). 값 자체는 어디에도 쓰지 않습니다.
function cleanEnv(env) {
  const clean = {};
  for (const name of ENV_NAMES) {
    const value = env?.[name];
    const memoId = name.endsWith('_ID');
    if (typeof value === 'string' && (memoId ? UUID.test(value) : SAFE_VALUE.test(value))) clean[name] = value;
  }
  return clean;
}

export async function runMatrix({ config, env = process.env, includeWrites = false, fetchImpl = fetch, now = () => new Date(), checks = CHECKS }) {
  const { app, original, issuer } = validateConfig(config);
  const ctx = { app, original, issuer, fetch: fetchImpl, now };
  const clean = cleanEnv(env);
  const rows = [];
  for (const check of checks) {
    if (check.evidence === 'local') { rows.push(await runLocal(check, ctx)); continue; }
    const missing = check.needs.filter((name) => !clean[name]);
    if (missing.length) { rows.push(skipped(check, `준비 없음: ${missing.join(', ')}`)); continue; }
    if (check.write && !includeWrites) { rows.push(skipped(check, '쓰기 허용 없음: --include-writes')); continue; }
    rows.push(await runDeploy(check, ctx, clean));
  }
  return { generatedAt: stamp(now), publicAppUrl: app.origin, step: config.step, rows, summary: summarize(rows) };
}

export function summarize(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  return {
    total: rows.length, passed: count('통과'), failed: count('실패'), errored: count('오류'), notRun: count('미실행'),
    // 41종은 종류 목록이 저장소에 없어 이 표와 연결하지 않으므로, 실행·통과로 세지 않습니다.
    attacks41: { total: ATTACK_TOTAL, executed: 0, passed: 0, notRun: ATTACK_TOTAL },
  };
}

// ---------- 표 출력 ----------
const cell = (value) => String(value ?? '-').replaceAll('|', '／').replaceAll('\n', ' ');

export function renderMarkdown(result) {
  const { summary } = result;
  const lines = [
    '# 1~11단계 정상·금지 요청 확인표', '',
    `- 확인 대상: ${result.publicAppUrl} (aleph.config.json 단계 ${result.step})`,
    `- 만든 시각: ${result.generatedAt}`,
    `- 합계: ${summary.total}건 중 통과 ${summary.passed} · 실패 ${summary.failed} · 오류 ${summary.errored} · 미실행 ${summary.notRun}`,
    '- 「통과」는 요청을 실제로 보내(또는 함수를 불러) 받은 결과가 기대와 같을 때만 적습니다. 「미실행」은 결과가 없는 것이며 통과가 아닙니다.',
    '- 근거 「배포」는 배포 주소로 보낸 실제 요청, 「로컬」은 이 컴퓨터에서 함수에 보낸 가상 요청이며 심판의 판정이 아닙니다.',
    '', '| 단계 | 구분 | 근거 | 요청 | 기대 결과 | 실제 결과 | 요청 ID | 확인 시각 | 상태 |', '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of result.rows) {
    const status = row.status === '미실행' ? `미실행 (${row.reason})` : row.status;
    lines.push(`| ${row.step} | ${row.kind} | ${row.evidence} | ${cell(row.request)} | ${cell(row.expected)} | ${cell(row.actual)} | ${cell(row.requestId)} | ${cell(row.checkedAt)} | ${cell(status)} |`);
  }
  lines.push('', '## 총공세 41종', '',
    `- 41종 중 이 표와 연결해 실행한 것: ${summary.attacks41.executed}건, 통과: ${summary.attacks41.passed}건, **미실행: ${summary.attacks41.notRun}건**.`,
    '- 41종의 종류 목록이 이 저장소에 없어 위 표의 항목을 41종으로 세지 않습니다. 심판의 총공세 결과가 나오기 전까지 통과로 쓰지 않습니다.', '');
  return `${lines.join('\n')}\n`;
}
