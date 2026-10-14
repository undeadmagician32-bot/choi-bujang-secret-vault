import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATTACK_TOTAL, CHECKS, renderMarkdown, runMatrix } from '../src/matrix.mjs';

const config = { step: 11, publicAppUrl: 'https://app.test/', originalApiUrl: 'https://db.test/rest/v1/memos',
  identityProvider: { issuer: 'https://db.test/auth/v1' } };
const now = () => new Date('2026-10-14T00:00:00Z');
const TOKEN_A = 'tokenAAAA.fake-value-1';
const COOKIE_A = 'cookieAAAA-fake-value-1';
const A_MEMO = 'a0a0a0a0-0000-4000-8000-000000000001';

// 가짜 서버: 규칙대로 거부하고 허용하는 "올바른" 배포. 요청마다 x-vercel-id를 붙입니다.
let counter = 0;
const reply = (status, body = '{}', headers = {}) => new Response(body, { status, headers: { 'x-vercel-id': `icn1::req${++counter}`, ...headers } });
const goodServer = (seen = []) => async (url, init = {}) => {
  const u = new URL(url);
  const auth = init.headers?.Authorization;
  const cookie = init.headers?.Cookie;
  seen.push({ path: u.pathname, auth, cookie });
  if (u.host === 'db.test') return reply(401);
  if (u.pathname === '/') return reply(200, '<html>login</html>', { 'x-content-type-options': 'nosniff' });
  if (u.pathname === '/data.json') return reply(404);
  if (u.pathname === '/aleph.json') return reply(200, JSON.stringify({ allowedRoutes: ['GET /api/memos'], originalApiUrl: 'https://db.test/rest/v1/memos' }));
  if (['/manifest.webmanifest', '/sw.js', '/offline.html'].includes(u.pathname)) return reply(200, 'x');
  if (!auth) return reply(401, '{"error":"LOGIN_REQUIRED"}');
  if (auth.includes('.') && !auth.includes('fake-value')) return reply(401, '{"error":"LOGIN_REQUIRED"}'); // 위조 토큰
  if (u.pathname === '/api/device') return reply(200, '{"state":"none"}');
  if (!cookie) return reply(403, '{"error":"DEVICE_NOT_APPROVED"}');
  if (u.pathname === '/api/memos') return reply(200, '[{"title":"가상 메모 제목","body":"가상 메모 본문"}]');
  return reply(200, '{}');
};
const run = (over = {}) => runMatrix({ config, now, ...over });

test('without any login material, only anonymous and local checks run and the rest stay 미실행', async () => {
  const result = await run({ env: {}, fetchImpl: goodServer() });
  const byStatus = (s) => result.rows.filter((r) => r.status === s);
  assert.equal(result.rows.length, CHECKS.length);
  assert.ok(byStatus('통과').length > 25);
  assert.equal(byStatus('실패').length, 0);
  assert.equal(byStatus('오류').length, 0);
  assert.ok(byStatus('미실행').length >= 8);
  for (const row of byStatus('미실행')) {
    assert.equal(row.actual, '-');
    assert.equal(row.requestId, null);
    assert.equal(row.checkedAt, null);
    assert.match(row.reason, /준비 없음|쓰기 허용 없음/u);
  }
  const s = result.summary;
  assert.equal(s.passed + s.failed + s.errored + s.notRun, s.total);
});

test('both normal and forbidden requests have measured results for steps 1~11 when anonymous checks pass', async () => {
  const { rows } = await run({ env: {}, fetchImpl: goodServer() });
  for (const step of [1, 3, 5, 6, 7, 8, 9, 10, 11]) {
    const measured = rows.filter((r) => r.step === step && r.status === '통과');
    assert.ok(measured.some((r) => r.kind === '금지'), `step ${step} has no measured forbidden request`);
    if (step !== 3 && step !== 10) assert.ok(measured.some((r) => r.kind === '정상'), `step ${step} has no measured normal request`);
  }
  // 2·4단계의 금지·정상 요청은 로그인한 계정이 필요해서 준비가 없으면 미실행으로 남습니다.
  assert.equal(rows.find((r) => r.id === 's04_b_read_a').status, '미실행');
  assert.equal(rows.find((r) => r.id === 's04_a_read_own').status, '미실행');
});

test('every executed row carries request id and check time; pass requires a matching real result', async () => {
  const { rows } = await run({ env: {}, fetchImpl: goodServer() });
  for (const row of rows.filter((r) => r.status === '통과' && r.evidence === '배포')) {
    assert.match(row.requestId, /^icn1::req\d+$/u);
    assert.equal(row.checkedAt, '2026-10-14T00:00:00.000Z');
  }
  for (const row of rows.filter((r) => r.evidence === '로컬' && r.id.startsWith('s0') && r.id !== 's09_detect_30_observe')) {
    if (row.id.startsWith('s09')) continue;
    assert.match(row.requestId, /^[0-9a-f-]{36}$/u); // 판정기에 보낸 요청의 requestId
  }
});

test('a forbidden request that is NOT refused is reported as 실패, never 통과', async () => {
  const leaky = async (url, init) => {
    const u = new URL(url);
    if (u.pathname === '/api/memos' && init.method === 'GET' && !init.headers.Authorization) return reply(200, '[]');
    return goodServer()(url, init);
  };
  const { rows, summary } = await run({ env: {}, fetchImpl: leaky });
  const row = rows.find((r) => r.id === 's03_memo_list_anon');
  assert.equal(row.status, '실패');
  assert.equal(row.actual, 'HTTP 200');
  assert.ok(summary.failed >= 1);
});

test('a normal request that is wrongly refused is 실패, and a network failure is 오류', async () => {
  const down = async (url, init) => { if (new URL(url).pathname === '/manifest.webmanifest') return reply(500); if (new URL(url).pathname === '/sw.js') throw new Error('network'); return goodServer()(url, init); };
  const { rows } = await run({ env: {}, fetchImpl: down });
  assert.equal(rows.find((r) => r.id === 's11_manifest').status, '실패');
  const broken = rows.find((r) => r.id === 's11_sw');
  assert.equal(broken.status, '오류');
  assert.equal(broken.requestId, null);
});

test('with login material the account checks run, and secrets never reach the results', async () => {
  const seen = [];
  const env = { VAULT_TOKEN_A: TOKEN_A, VAULT_DEVICE_COOKIE_A: COOKIE_A, VAULT_A_MEMO_ID: A_MEMO };
  const result = await run({ env, fetchImpl: goodServer(seen) });
  const row = (id) => result.rows.find((r) => r.id === id);
  assert.equal(row('s03_a_list').status, '통과');
  assert.equal(row('s04_a_read_own').status, '통과');
  assert.equal(row('s11_a_memos_no_cookie').status, '통과');
  assert.equal(row('s11_a_memos_no_cookie').actual, 'HTTP 403 DEVICE_NOT_APPROVED');
  assert.equal(row('s11_a_device_status').status, '통과');
  assert.equal(row('s04_b_read_a').status, '미실행'); // B 준비 없음
  assert.equal(row('s10_restore_b_own').status, '미실행');
  assert.ok(seen.some((r) => r.auth === `Bearer ${TOKEN_A}` && r.cookie === `vault_device=${COOKIE_A}`));
  const out = JSON.stringify(result) + renderMarkdown(result);
  for (const secret of [TOKEN_A, COOKIE_A, A_MEMO, '가상 메모 제목', '가상 메모 본문']) assert.equal(out.includes(secret), false, `leaked ${secret}`);
});

test('write checks stay 미실행 unless --include-writes is given', async () => {
  const env = { VAULT_TOKEN_A: TOKEN_A, VAULT_DEVICE_COOKIE_A: COOKIE_A, VAULT_TOKEN_B: 'tokenBBBB.fake-value-2',
    VAULT_DEVICE_COOKIE_B: 'cookieBBBB-fake-value-2', VAULT_B_RESTORE_ID: 'b0b0b0b0-0000-4000-8000-000000000002' };
  const off = await run({ env, fetchImpl: goodServer() });
  assert.match(off.rows.find((r) => r.id === 's10_restore_a_takes_b').reason, /include-writes/u);
  const on = await run({ env, includeWrites: true, fetchImpl: goodServer() });
  assert.notEqual(on.rows.find((r) => r.id === 's10_restore_a_takes_b').status, '미실행');
});

test('unsafe env values are ignored instead of being sent', async () => {
  const seen = [];
  const env = { VAULT_TOKEN_A: 'bad\r\nX-Evil: 1', VAULT_DEVICE_COOKIE_A: COOKIE_A };
  const result = await run({ env, fetchImpl: goodServer(seen) });
  assert.equal(result.rows.find((r) => r.id === 's03_a_list').status, '미실행');
  assert.equal(seen.some((r) => String(r.auth).includes('Evil')), false);
});

test('the 41 attack types are never counted as run or passed by this table', async () => {
  const result = await run({ env: {}, fetchImpl: goodServer() });
  assert.deepEqual(result.summary.attacks41, { total: ATTACK_TOTAL, executed: 0, passed: 0, notRun: 41 });
  const md = renderMarkdown(result);
  assert.match(md, /미실행: 41건/u);
  assert.match(md, /\| 단계 \| 구분 \| 근거 \| 요청 \| 기대 결과 \| 실제 결과 \| 요청 ID \| 확인 시각 \| 상태 \|/u);
});
