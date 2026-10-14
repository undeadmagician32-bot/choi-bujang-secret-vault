import assert from 'node:assert/strict';
import test from 'node:test';
import { contentHashOf, restoreMemo } from '../src/memo-restore.mjs';
import { resourceIdFor } from '../src/resources.mjs';

// 모두 가상 값입니다. 시험 계정 B의 메모 한 건과, 비교용 다른 메모 두 건.
const A = 'a0a0a0a0-0000-4000-8000-00000000000a';
const B = 'b0b0b0b0-0000-4000-8000-00000000000b';
const B_MEMO = 'b0b0b0b0-0000-4000-8000-000000000001';
const B_OTHER = 'b0b0b0b0-0000-4000-8000-000000000002';
const A_MEMO = 'a0a0a0a0-0000-4000-8000-000000000001';

function makeStore({ backupPatch = {}, extraMemos = [] } = {}) {
  const backups = new Map();
  const memos = new Map();
  const auditLog = [];
  const put = (m, id, owner, title, body, patch = {}) => m.set(id, { memo_id: id, id, owner_id: owner, title, body,
    content_hash: contentHashOf(title, body), ...patch });
  put(backups, B_MEMO, B, '가상 제목', '가상 본문 원본', backupPatch);
  put(backups, A_MEMO, A, 'A 가상 제목', 'A 가상 본문');
  put(memos, B_OTHER, B, '다른 메모', '그대로여야 함');
  for (const m of extraMemos) memos.set(m.id, m);
  const writes = [];
  return {
    memos, auditLog, writes,
    getBackup: async (id) => backups.get(id) ?? null,
    getMemo: async (id) => memos.get(id) ?? null,
    insertMemo: async (row) => { writes.push(['insert', row.id]); memos.set(row.id, { ...row }); },
    updateMemo: async (row) => { writes.push(['update', row.id]); memos.set(row.id, { ...memos.get(row.id), ...row }); },
    insertAudit: async (row) => { auditLog.push(row); },
  };
}

const run = (store, args) => restoreMemo({ store, now: () => new Date('2026-10-14T00:00:00Z'), ...args });

test('B의 지워진 메모 한 건이 사본의 ID·소유자·내용 그대로 돌아옴', async () => {
  const store = makeStore();
  const expected = contentHashOf('가상 제목', '가상 본문 원본');
  const result = await run(store, { userId: B, id: B_MEMO, input: { contentHash: expected } });
  assert.deepEqual(result, { status: 200, body: { id: B_MEMO, contentHash: expected } });
  const restored = store.memos.get(B_MEMO);
  assert.equal(restored.id, B_MEMO);
  assert.equal(restored.owner_id, B);
  assert.equal(contentHashOf(restored.title, restored.body), expected);
  assert.deepEqual(store.writes, [['insert', B_MEMO]]);
  assert.equal(JSON.stringify(result).includes('가상'), false);
});

test('다른 메모와 감사 기록은 보존되고 감사 기록은 늘기만 함', async () => {
  const store = makeStore();
  const before = { ...store.memos.get(B_OTHER) };
  await run(store, { userId: B, id: B_MEMO, input: {} });
  assert.deepEqual(store.memos.get(B_OTHER), before);
  assert.deepEqual(store.auditLog.map((r) => r.outcome), ['restoring', 'restored']);
  assert.ok(store.auditLog.every((r) => r.memo_id === B_MEMO && r.owner_id === B && !('body' in r) && !('title' in r)));
  await run(store, { userId: B, id: B_MEMO, input: {} });
  assert.equal(store.auditLog.length, 4);
  assert.deepEqual(store.writes, [['insert', B_MEMO], ['update', B_MEMO]]);
});

test('A가 B의 사본을 지정하면 404이고 아무것도 쓰지 않음', async () => {
  const store = makeStore();
  const result = await run(store, { userId: A, id: B_MEMO, input: {} });
  assert.equal(result.status, 404);
  assert.deepEqual(store.writes, []);
  assert.equal(store.memos.has(B_MEMO), false);
  assert.deepEqual(store.auditLog.map((r) => r.outcome), ['denied_not_found']);
});

test('없는 사본도 남의 사본과 같은 404', async () => {
  const store = makeStore();
  const a = await run(store, { userId: B, id: 'b0b0b0b0-0000-4000-8000-0000000000ff', input: {} });
  const b = await run(store, { userId: A, id: B_MEMO, input: {} });
  assert.deepEqual(a, b);
});

test('내용 해시가 다르면 거부', async () => {
  const wrong = contentHashOf('다른', '내용');
  const s1 = makeStore();
  assert.deepEqual((await run(s1, { userId: B, id: B_MEMO, input: { contentHash: wrong } })).body, { error: 'HASH_MISMATCH' });
  assert.deepEqual(s1.writes, []);
  const s2 = makeStore({ backupPatch: { body: '바뀐 본문' } }); // 사본이 몰래 바뀜
  assert.deepEqual((await run(s2, { userId: B, id: B_MEMO, input: {} })).body, { error: 'BACKUP_INTEGRITY_FAILED' });
  assert.deepEqual(s2.writes, []);
  const s3 = makeStore();
  assert.equal((await run(s3, { userId: B, id: B_MEMO, input: { contentHash: 'zz' } })).status, 400);
});

test('사본의 ID가 요청 ID와 다르거나 현재 메모가 남의 소유면 덮어쓰지 않음', async () => {
  const s1 = makeStore({ backupPatch: { memo_id: B_OTHER } });
  assert.equal((await run(s1, { userId: B, id: B_MEMO, input: {} })).status, 404);
  const s2 = makeStore({ extraMemos: [{ id: B_MEMO, owner_id: A, title: 'A의 것', body: 'x' }] });
  assert.equal((await run(s2, { userId: B, id: B_MEMO, input: {} })).status, 404);
  assert.equal(s2.memos.get(B_MEMO).owner_id, A);
  assert.deepEqual(s2.writes, []);
});

test('감사 기록을 남기지 못하면 복원하지 않음', async () => {
  const store = makeStore();
  store.insertAudit = async () => { throw new Error('audit down'); };
  await assert.rejects(run(store, { userId: B, id: B_MEMO, input: {} }), /audit down/u);
  assert.deepEqual(store.writes, []);
});

test('잘못된 ID 형식과 자원 ID 표', async () => {
  assert.equal((await run(makeStore(), { userId: B, id: '../x', input: {} })).status, 400);
  assert.equal(resourceIdFor('POST /api/memo-restore/:id'), 'vault.memo');
});
