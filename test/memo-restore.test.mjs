import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { memoContentSha256 } from '../src/memo-api.mjs';

// 가짜 로그인·가짜 DB로만 시험합니다. 실제 Supabase나 배포에는 요청하지 않습니다.
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMO_A = '11111111-1111-4111-8111-111111111111';
const MEMO_B = '22222222-2222-4222-8222-222222222222';
const MEMO_B2 = '33333333-3333-4333-8333-333333333333';
const NEW_ID = '44444444-4444-4444-8444-444444444444';

const state = { userId: null, tables: null, failAudit: false, failBackup: false, ops: [] };

function fakeDb(tables) {
  return {
    from(name) {
      const rows = tables[name];
      const filters = []; let op = 'select'; let patch;
      const match = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      // 서버 함수가 어느 표에 무엇을 했는지 기록합니다(표, 작업, 거른 조건).
      const log = (kind) => state.ops.push({ table: name, op: kind, filters: Object.fromEntries(filters) });
      const q = {
        select() { return q; },
        eq(c, v) { filters.push([c, v]); return q; },
        update(p) { op = 'update'; patch = p; return q; },
        insert(row) {
          log('insert');
          if (name === 'memos_restore_audit' && state.failAudit) return Promise.resolve({ error: { code: 'XX000' } });
          if (row.id !== undefined && rows.some((r) => r.id === row.id)) return Promise.resolve({ error: { code: '23505' } });
          rows.push({ ...row });
          return Promise.resolve({ error: null });
        },
        upsert(row, options) {
          log('upsert');
          if (state.failBackup) return Promise.resolve({ error: { code: '42P01' } });
          assert.equal(options.ignoreDuplicates, true);
          if (!rows.some((r) => r.id === row.id)) rows.push({ ...row });
          return Promise.resolve({ error: null });
        },
        maybeSingle: () => { log('select'); return Promise.resolve({ data: match()[0] ?? null, error: null }); },
        then(resolve) {
          log(op);
          const m = match();
          if (op === 'update') m.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: m.map((r) => ({ id: r.id })), error: null }).then(resolve);
        },
      };
      return q;
    },
  };
}

const memoRow = (id, owner, title, body) => ({ id, owner_id: owner, title, body });
const backupRow = (id, owner, title, body) => ({ ...memoRow(id, owner, title, body), content_sha256: memoContentSha256(title, body) });
const snapshot = (rows) => JSON.stringify(rows);

const real = await import('../src/memo-api.mjs');
mock.module(new URL('../src/memo-api.mjs', import.meta.url).href, {
  namedExports: { ...real, authorize: async () => ({ userId: state.userId, supabase: fakeDb(state.tables) }) },
});
const { default: restore } = await import('../api/memos/restore/[id].js');
const { default: memos } = await import('../api/memos/index.js');

function setup() {
  state.failAudit = false; state.failBackup = false; state.ops = [];
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
    memos_restore_audit: [],
  };
}

async function call(handler, user, request) {
  state.userId = user;
  const response = {
    headers: {}, code: null, body: null,
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; },
  };
  const warn = console.warn; const info = console.info; const error = console.error;
  console.warn = console.info = console.error = () => {};
  try { await handler({ headers: {}, ...request }, response); } finally { Object.assign(console, { warn, info, error }); }
  return response;
}
const restoreCall = (user, id, extra = {}) => call(restore, user, { method: 'POST', query: { id }, ...extra });

test('B가 자기 메모 한 건을 복원하면 ID·소유자·내용 해시가 사본과 같고 감사 기록이 한 줄 늘며 다른 것은 그대로입니다', async () => {
  setup();
  const backupBefore = snapshot(state.tables.memos_backup);
  const othersBefore = snapshot(state.tables.memos.filter((r) => r.id !== MEMO_B));
  const response = await restoreCall(B, MEMO_B);
  assert.equal(response.code, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['contentHash', 'contentSha256', 'id', 'restored']);
  assert.equal(response.body.contentHash, response.body.contentSha256);
  assert.equal(response.headers['X-Resource-Id'], 'vault.memo');
  const live = state.tables.memos.find((r) => r.id === MEMO_B);
  const backup = state.tables.memos_backup.find((r) => r.id === MEMO_B);
  assert.equal(live.id, backup.id);
  assert.equal(live.owner_id, backup.owner_id);
  assert.equal(memoContentSha256(live.title, live.body), backup.content_sha256);
  assert.equal(response.body.contentSha256, backup.content_sha256);
  assert.equal(snapshot(state.tables.memos.filter((r) => r.id !== MEMO_B)), othersBefore);
  assert.equal(snapshot(state.tables.memos_backup), backupBefore);
  assert.deepEqual(state.tables.memos_restore_audit, [
    { memo_id: MEMO_B, owner_id: B, content_sha256: backup.content_sha256, outcome: 'restored' }]);
});

test('요청 본문은 읽지 않습니다: 본문의 owner_id·제목은 무시됩니다', async () => {
  setup();
  const response = await restoreCall(B, MEMO_B, { body: { owner_id: A, title: '탈취', body: 'x' } });
  assert.equal(response.code, 200);
  const live = state.tables.memos.find((r) => r.id === MEMO_B);
  assert.equal(live.owner_id, B);
  assert.equal(live.title, 'B 메모');
});

test('B의 메모가 지워졌어도 같은 ID로 B 소유로 되살립니다', async () => {
  setup();
  state.tables.memos = state.tables.memos.filter((r) => r.id !== MEMO_B);
  const response = await restoreCall(B, MEMO_B);
  assert.equal(response.code, 200);
  const live = state.tables.memos.find((r) => r.id === MEMO_B);
  assert.equal(live.owner_id, B);
  assert.equal(memoContentSha256(live.title, live.body), state.tables.memos_backup.find((r) => r.id === MEMO_B).content_sha256);
});

test('B가 A의 메모 ID로 요청하면 404이고 A의 메모·사본·감사 기록은 그대로입니다', async () => {
  setup();
  state.tables.memos.find((r) => r.id === MEMO_A).title = 'A가 나중에 고침';
  const before = snapshot(state.tables);
  const response = await restoreCall(B, MEMO_A);
  assert.equal(response.code, 404);
  assert.deepEqual(response.body, { error: 'NOT_FOUND' });
  assert.equal(snapshot(state.tables), before);
  assert.equal((await restoreCall(B, '99999999-9999-4999-8999-999999999999')).code, 404);
});

test('사본의 내용 해시가 맞지 않으면 409로 거부하고 메모와 감사 기록을 바꾸지 않습니다', async () => {
  setup();
  state.tables.memos_backup.find((r) => r.id === MEMO_B).body = '사본이 몰래 바뀜';
  const before = snapshot([state.tables.memos, state.tables.memos_restore_audit]);
  const response = await restoreCall(B, MEMO_B);
  assert.equal(response.code, 409);
  assert.deepEqual(response.body, { error: 'BACKUP_UNVERIFIED' });
  assert.equal(snapshot([state.tables.memos, state.tables.memos_restore_audit]), before);
});

test('같은 ID의 살아 있는 행이 B 것이 아니면 덮어쓰지 않고 404입니다', async () => {
  setup();
  state.tables.memos = state.tables.memos.filter((r) => r.id !== MEMO_B);
  state.tables.memos.push(memoRow(MEMO_B, A, 'A가 차지한 행', 'A 본문'));
  const before = snapshot(state.tables.memos);
  const response = await restoreCall(B, MEMO_B);
  assert.equal(response.code, 404);
  assert.equal(snapshot(state.tables.memos), before);
  assert.equal(state.tables.memos_restore_audit.length, 0);
});

test('감사 기록을 덧붙이지 못하면 500 AUDIT_FAILED로 알립니다', async () => {
  setup();
  state.failAudit = true;
  const response = await restoreCall(B, MEMO_B);
  assert.equal(response.code, 500);
  assert.deepEqual(response.body, { error: 'AUDIT_FAILED' });
  assert.equal(state.tables.memos_restore_audit.length, 0);
});

test('POST가 아니거나 ID 형식이 틀리면 거부합니다', async () => {
  setup();
  const before = snapshot(state.tables);
  assert.equal((await call(restore, B, { method: 'GET', query: { id: MEMO_B } })).code, 405);
  assert.equal((await restoreCall(B, 'not-a-uuid')).code, 400);
  assert.equal((await call(restore, B, { method: 'POST', query: {} })).code, 400);
  assert.equal(snapshot(state.tables), before);
});

test('메모를 새로 만들면 비공개 사본이 덧붙고, 이미 있는 사본은 가장 이른 내용으로 남습니다', async () => {
  setup();
  const created = await call(memos, B, { method: 'POST', body: { id: NEW_ID, title: '새 메모', body: '처음 본문' } });
  assert.equal(created.code, 201);
  const live = state.tables.memos.find((r) => r.id === NEW_ID);
  const backup = state.tables.memos_backup.find((r) => r.id === NEW_ID);
  assert.equal(live.owner_id, B);
  assert.equal(backup.owner_id, B);
  assert.equal(backup.content_sha256, memoContentSha256('새 메모', '처음 본문'));
  // 같은 ID로 다시 만들면 메모는 409이고 사본은 그대로입니다.
  const again = await call(memos, B, { method: 'POST', body: { id: NEW_ID, title: '덮어쓰기', body: '다른 본문' } });
  assert.equal(again.code, 409);
  assert.equal(state.tables.memos_backup.find((r) => r.id === NEW_ID).body, '처음 본문');
  // 새 메모를 고쳐도(침해) 복원하면 처음 사본으로 돌아옵니다.
  state.tables.memos.find((r) => r.id === NEW_ID).body = '침해된 본문';
  assert.equal((await restoreCall(B, NEW_ID)).code, 200);
  assert.equal(state.tables.memos.find((r) => r.id === NEW_ID).body, '처음 본문');
});

test('사본을 쓰지 못해도 메모 만들기는 성공합니다(고정 코드만 로그에 남김)', async () => {
  setup();
  state.failBackup = true;
  const created = await call(memos, B, { method: 'POST', body: { id: NEW_ID, title: '새 메모', body: '본문' } });
  assert.equal(created.code, 201);
  assert.equal(state.tables.memos_backup.some((r) => r.id === NEW_ID), false);
  assert.equal((await restoreCall(B, NEW_ID)).code, 404);
});

const writesOnly = () => state.ops.filter((o) => o.op !== 'select');

test('복원은 지정한 한 건과 감사 기록 덧붙이기 외에는 아무것도 쓰지 않고 기존 감사 기록은 그대로 남습니다', async () => {
  setup();
  // 다른 메모(같은 소유자)도 변조된 상태입니다. 지정하지 않았으니 복원되면 안 됩니다.
  state.tables.memos.find((r) => r.id === MEMO_B2).body = '다른 메모의 변조는 건드리지 않아야 함';
  state.tables.memos_restore_audit.push(
    { memo_id: MEMO_A, owner_id: A, content_sha256: 'a'.repeat(64), outcome: 'restored' },
    { memo_id: MEMO_B2, owner_id: B, content_sha256: 'b'.repeat(64), outcome: 'restored' },
  );
  const auditBefore = snapshot(state.tables.memos_restore_audit);
  const backupBefore = snapshot(state.tables.memos_backup);
  const othersBefore = snapshot(state.tables.memos.filter((r) => r.id !== MEMO_B));
  state.ops = [];
  const response = await restoreCall(B, MEMO_B);
  assert.equal(response.code, 200);
  // 쓰기는 정확히 두 가지: 지정한 메모 한 행의 수정, 감사 기록 한 줄 덧붙이기.
  assert.deepEqual(writesOnly(), [
    { table: 'memos', op: 'update', filters: { id: MEMO_B, owner_id: B } },
    { table: 'memos_restore_audit', op: 'insert', filters: {} },
  ]);
  // 사본 표는 읽기만 하고, 삭제·덮어쓰기는 어디에도 없습니다.
  assert.deepEqual([...new Set(state.ops.filter((o) => o.table === 'memos_backup').map((o) => o.op))], ['select']);
  assert.equal(state.ops.some((o) => ['delete', 'upsert', 'truncate'].includes(o.op)), false);
  assert.equal(snapshot(state.tables.memos_backup), backupBefore);
  assert.equal(snapshot(state.tables.memos.filter((r) => r.id !== MEMO_B)), othersBefore);
  // 기존 감사 기록 두 줄은 그대로이고 새 기록이 뒤에 한 줄 붙습니다.
  assert.equal(state.tables.memos_restore_audit.length, 3);
  assert.equal(snapshot(state.tables.memos_restore_audit.slice(0, 2)), auditBefore);
  assert.deepEqual(state.tables.memos_restore_audit[2].memo_id, MEMO_B);
});

test('거부된 복원(남의 메모 404, 사본 해시 불일치 409, 형식 오류 400)은 어느 표에도 쓰지 않습니다', async () => {
  setup();
  state.tables.memos_backup.find((r) => r.id === MEMO_B2).body = '사본이 몰래 바뀜';
  state.tables.memos_restore_audit.push({ memo_id: MEMO_A, owner_id: A, content_sha256: 'a'.repeat(64), outcome: 'restored' });
  const before = snapshot(state.tables);
  state.ops = [];
  assert.equal((await restoreCall(B, MEMO_A)).code, 404);
  assert.equal((await restoreCall(B, MEMO_B2)).code, 409);
  assert.equal((await restoreCall(B, 'not-a-uuid')).code, 400);
  assert.deepEqual(writesOnly(), []);
  assert.equal(snapshot(state.tables), before);
});
