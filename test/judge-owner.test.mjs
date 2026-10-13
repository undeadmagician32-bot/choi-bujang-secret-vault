import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// 심판 토큰(같은 sub, identity a/b)과 학생 토큰의 주인 키를 시험합니다. 가짜 로그인 검사기만 쓰고 네트워크 요청은 없습니다.
Object.assign(process.env, { SUPABASE_URL: 'https://project-ref.supabase.co', SUPABASE_SECRET_KEY: 'dummy-for-test' });

const SUB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_SUB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const verifiedNow = { current: null };
mock.module(new URL('../src/verify-login.mjs', import.meta.url).href, {
  namedExports: { createLoginVerifier: () => async () => verifiedNow.current },
});
const { authorize, isUuid, ownerKeyFor } = await import('../src/memo-api.mjs');

const judge = (identity, userId = SUB) => ({ kind: 'judge', userId, identity, runId: 'r' });

test('같은 sub의 심판 A·B는 서로 다른 고정 UUID 주인 키를 받습니다', () => {
  const a = ownerKeyFor(judge('a'));
  const b = ownerKeyFor(judge('b'));
  assert.notEqual(a, b);
  assert.notEqual(a, SUB);
  assert.ok(isUuid(a) && isUuid(b));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  assert.equal(ownerKeyFor(judge('a')), a, '같은 입력은 같은 키');
  assert.notEqual(ownerKeyFor(judge('a', OTHER_SUB)), a, 'sub가 다르면 다른 키');
});

test('학생 토큰은 서버가 확인한 sub를 그대로 씁니다', () => {
  assert.equal(ownerKeyFor({ kind: 'student', userId: SUB }), SUB);
});

test('authorize는 확인된 토큰 종류에 따라 주인 키를 정하고, 확인 실패는 401입니다', async () => {
  const run = async (verified) => {
    verifiedNow.current = verified;
    const response = { headers: {}, code: null, body: null,
      setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; } };
    const session = await authorize({ headers: { authorization: 'Bearer x' } }, response);
    return { session, response };
  };
  const a = await run(judge('a'));
  const b = await run(judge('b'));
  assert.equal(a.session.userId, ownerKeyFor(judge('a')));
  assert.equal(b.session.userId, ownerKeyFor(judge('b')));
  assert.notEqual(a.session.userId, b.session.userId);
  assert.equal((await run({ kind: 'student', userId: SUB })).session.userId, SUB);
  const denied = await run(null);
  assert.equal(denied.session, null);
  assert.equal(denied.response.code, 401);
});
