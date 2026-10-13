import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { memoContentSha256 } from '../src/memo-api.mjs';

// 가짜 로그인·가짜 DB로만 시험합니다. 실제 Supabase나 배포에는 요청하지 않습니다.
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMO_A = '11111111-1111-4111-8111-111111111111';
const MEMO_B = '22222222-2222-4222-8222-222222222222';
const MEMO_B2 = '33333333-3333-4333-8333-333333333333';

function fakeDb(tables) {
  return {
    from(name) {
      const rows = tables[name];
      const filters = []; let op = 'select'; let patch; let inserted;
      const match = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      const q = {
        select() { return q; },
        eq(c, v) { filters.push([c, v]); return q; },
        update(p) { op = 'update'; patch = p; return q; },
        insert(row) {
          if (rows.some((r) => r.id === row.id)) return Promise.resolve({ error: { code: '23505' } });
          rows.push({ ...row }); inserted = true;
          return Promise.resolve({ error: null });
        },
        maybeSingle: () => Promise.resolve({ data: match()[0] ?? null, error: null }),
        then(resolve) {
          const m = match();
          if (op === 'update') m.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: m.map((r) => ({ id: r.id })), error: null, inserted }).then(resolve);
        },
      };
      return q;
    },
  };
}

const memoRow = (id, owner, title, body) => ({ id, owner_id: owner, title, body });
const backupRow = (id, owner, title, body) => ({ ...memoRow(id, owner, title, body), content_sha256: memoContentSha256(title, body) });
const snapshot = (rows) => JSON.stringify(rows);

const state = { userId: null, tables: null };
const real = await import('../src/memo-api.mjs');
mock.module(new URL('../src/memo-api.mjs', import.meta.url).href, {
  namedExports: { ...real, authorize: async () => ({ userId: state.userId, supabase: fakeDb(state.tables) }) },
});
const { default: handler } = await import('../api/memos/restore.js');

function setup() {
  state.tables = {
    memos: [
      memoRow(MEMO_A, A, 'A 메모', 'A 가상 본문'),
      memoRow(MEMO_B, B, 'B 메모 (침해로 바뀜)', '바뀐 본문'),
      memoRow(MEMO_B2, B, 'B 다른 메모', '건드리면 안 되는 본문'),
    ],
    memos_backup: [
      backupRow(MEMO_A, A, 'A 메모', 'A 가상 본문'),
      backupRow(MEMO_B, B, 'B 메모', 'B 가상 본문 ✓'),
      backupRow(MEMO_B2, B, 'B 다른 메모', '건드리면 안 되는 본문'),
    ],
  };
}

async function call(user, method, body) {
  state.userId = user;
  const response = {
    headers: {}, code: null, body: null,
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; },
  };
  const warn = console.warn; const info = console.info; const error = console.error;
  console.warn = console.info = console.error = () => {};
  try { await handler({ method, body, headers: {} }, response); } finally { Object.assign(console, { warn, info, error }); }
  return response;
}

test('B가 자기 메모 한 건을 복원하면 ID·소유자·내용 해시가 사본과 같고 다른 것은 그대로입니다', async () => {
  setup();
  const backupBefore = snapshot(state.tables.memos_backup);
  const othersBefore = snapshot(state.tables.memos.filter((r) => r.id !== MEMO_B));
  const response = await call(B, 'POST', { id: MEMO_B });
  assert.equal(response.code, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['contentSha256', 'id', 'restored']);
  assert.equal(response.headers['X-Resource-Id'], 'vault.memo');
  const live = state.tables.memos.find((r) => r.id === MEMO_B);
  const backup = state.tables.memos_backup.find((r) => r.id === MEMO_B);
  assert.equal(live.id, backup.id);
  assert.equal(live.owner_id, backup.owner_id);
  assert.equal(memoContentSha256(live.title, live.body), backup.content_sha256);
  assert.equal(response.body.contentSha256, backup.content_sha256);
  assert.equal(snapshot(state.tables.memos.filter((r) => r.id !== MEMO_B)), othersBefore);
  assert.equal(snapshot(state.tables.memos_backup), backupBefore);
});

test('B의 메모가 지워졌어도 같은 ID로 B 소유로 되살립니다', async () => {
  setup();
  state.tables.memos = state.tables.memos.filter((r) => r.id !== MEMO_B);
  const response = await call(B, 'POST', { id: MEMO_B });
  assert.equal(response.code, 200);
  const live = state.tables.memos.find((r) => r.id === MEMO_B);
  assert.equal(live.owner_id, B);
  assert.equal(memoContentSha256(live.title, live.body), state.tables.memos_backup.find((r) => r.id === MEMO_B).content_sha256);
});

test('B가 A의 메모 ID로 요청하면 404이고 A의 메모와 사본은 그대로입니다', async () => {
  setup();
  const before = snapshot([state.tables.memos, state.tables.memos_backup]);
  state.tables.memos.find((r) => r.id === MEMO_A).title = 'A가 나중에 고침';
  const afterEdit = snapshot([state.tables.memos, state.tables.memos_backup]);
  const response = await call(B, 'POST', { id: MEMO_A });
  assert.equal(response.code, 404);
  assert.deepEqual(response.body, { error: 'NOT_FOUND' });
  assert.equal(snapshot([state.tables.memos, state.tables.memos_backup]), afterEdit);
  assert.notEqual(before, afterEdit);
  assert.equal((await call(B, 'POST', { id: '99999999-9999-4999-8999-999999999999' })).code, 404);
});

test('사본의 내용 해시가 맞지 않으면 409로 거부하고 메모를 바꾸지 않습니다', async () => {
  setup();
  state.tables.memos_backup.find((r) => r.id === MEMO_B).body = '사본이 몰래 바뀜';
  const before = snapshot(state.tables.memos);
  const response = await call(B, 'POST', { id: MEMO_B });
  assert.equal(response.code, 409);
  assert.deepEqual(response.body, { error: 'BACKUP_UNVERIFIED' });
  assert.equal(snapshot(state.tables.memos), before);
});

test('같은 ID의 살아 있는 행이 B 것이 아니면 덮어쓰지 않고 404입니다', async () => {
  setup();
  state.tables.memos = state.tables.memos.filter((r) => r.id !== MEMO_B);
  state.tables.memos.push(memoRow(MEMO_B, A, 'A가 차지한 행', 'A 본문'));
  const before = snapshot(state.tables.memos);
  const response = await call(B, 'POST', { id: MEMO_B });
  assert.equal(response.code, 404);
  assert.equal(snapshot(state.tables.memos), before);
});

test('POST가 아니거나 본문이 id 하나가 아니면 거부합니다', async () => {
  setup();
  const before = snapshot(state.tables.memos);
  assert.equal((await call(B, 'GET')).code, 405);
  assert.equal((await call(B, 'POST', { id: MEMO_B, owner_id: A })).code, 400);
  assert.equal((await call(B, 'POST', { id: MEMO_B, title: '덮어쓰기' })).code, 400);
  assert.equal((await call(B, 'POST', { id: 'not-a-uuid' })).code, 400);
  assert.equal((await call(B, 'POST', {})).code, 400);
  assert.equal((await call(B, 'POST', '[]')).code, 400);
  assert.equal(snapshot(state.tables.memos), before);
});
