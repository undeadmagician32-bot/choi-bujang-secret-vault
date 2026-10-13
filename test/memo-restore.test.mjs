import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeEach, mock, test } from 'node:test';
import { pathToFileURL } from 'node:url';

// 10단계 POST /api/memos/restore 연습: 가짜 로그인·가짜 DB에서 시험 계정 B의 가상 메모만 복원합니다.
// 실제 Supabase·배포·학생 기록에는 요청하지 않으며 심판 판정이 아닙니다.
const root = resolve(import.meta.dirname, '..');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const B_MEMO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const B_OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002';
const A_MEMO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hash = (title, body) => createHash('sha256')
  .update(Buffer.concat([Buffer.from(title), Buffer.from([0]), Buffer.from(body)])).digest('hex');
let db;
const logs = [];

class FakeQuery {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.single = false; }
  select() { return this; }
  update(values) { this.op = 'update'; this.values = values; return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  eq(key, value) { this.filters.push([key, value]); return this; }
  maybeSingle() { this.single = true; return this; }
  then(resolve, reject) {
    const rows = db[this.table];
    const matched = rows.filter(row => this.filters.every(([key, value]) => row[key] === value));
    let result = { data: null, error: null };
    if (this.op === 'select') result.data = this.single ? (matched[0] ? { ...matched[0] } : null) : matched.map(row => ({ ...row }));
    if (this.op === 'update') { for (const row of matched) Object.assign(row, this.values); result.data = matched.map(row => ({ id: row.id })); }
    if (this.op === 'insert') {
      if (rows.some(row => row.id === this.row.id)) result.error = { code: '23505' };
      else rows.push({ ...this.row });
    }
    return Promise.resolve(result).then(resolve, reject);
  }
}

mock.module(pathToFileURL(resolve(root, 'src/verify-login.mjs')).href, { exports: {
  createLoginVerifier: () => async header => (header === 'Bearer b' ? { userId: B } : null) } });
mock.module('@supabase/supabase-js', { exports: { createClient: () => ({ from: table => new FakeQuery(table) }) } });
process.env.SUPABASE_URL = 'https://fake.invalid';
process.env.SUPABASE_SECRET_KEY = 'fake-test-only';
for (const level of ['info', 'warn', 'error']) mock.method(console, level, (...args) => logs.push(args.join(' ')));
const { default: handler } = await import('../api/memos/restore.js');

async function restore(body, { user = 'b', method = 'POST' } = {}) {
  const response = { statusCode: 0, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; } };
  await handler({ method, headers: user ? { authorization: `Bearer ${user}` } : {}, body }, response);
  return response;
}

const backupOf = (row) => ({ ...row, content_sha256: hash(row.title, row.body) });
const snapshot = () => JSON.stringify(db);
const bMemo = { id: B_MEMO, owner_id: B, title: 'B 가상 메모', body: 'SAMPLE_NOTE_B' };
const bOther = { id: B_OTHER, owner_id: B, title: 'B 다른 메모', body: 'SAMPLE_NOTE_B2' };
const aMemo = { id: A_MEMO, owner_id: A, title: 'A 가상 메모', body: 'SAMPLE_NOTE_A' };

beforeEach(() => {
  logs.length = 0;
  db = {
    memos: [{ ...bMemo, body: '침해로 바뀐 내용' }, { ...bOther, body: 'B가 나중에 고친 내용' }, { ...aMemo }],
    memos_backup: [backupOf(bMemo), backupOf(bOther), backupOf(aMemo)],
    restore_audit: [{ at: '2026-10-01T00:00:00.000Z', action: 'earlier_record' }],
  };
});

const current = id => db.memos.find(row => row.id === id);
const same = (row, backup) => row.id === backup.id && row.owner_id === backup.owner_id
  && hash(row.title, row.body) === backup.content_sha256;

test('B의 바뀐 메모 한 건 복원: ID·소유자·내용 해시가 사본과 같고 다른 메모·기록은 그대로', async () => {
  const otherBefore = JSON.stringify(db.memos.filter(row => row.id !== B_MEMO));
  const backupBefore = JSON.stringify(db.memos_backup);
  const auditBefore = JSON.stringify(db.restore_audit);
  const res = await restore({ id: B_MEMO });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { id: B_MEMO, restored: true, contentSha256: hash(bMemo.title, bMemo.body) });
  assert.equal(res.headers['X-Resource-Id'], 'vault.memo');
  assert.ok(same(current(B_MEMO), db.memos_backup[0]));
  assert.equal(JSON.stringify(db.memos.filter(row => row.id !== B_MEMO)), otherBefore, 'B 다른 메모·A 메모 그대로');
  assert.equal(JSON.stringify(db.memos_backup), backupBefore, '사본 그대로');
  assert.equal(JSON.stringify(db.restore_audit), auditBefore, '기록 테이블 그대로');
  assert.deepEqual(logs, ['MEMO_RESTORED']);
});

test('지워진 B 메모 한 건을 같은 ID·소유자·내용으로 다시 만듦', async () => {
  db.memos = db.memos.filter(row => row.id !== B_MEMO);
  const res = await restore({ id: B_MEMO });
  assert.equal(res.statusCode, 200);
  assert.ok(same(current(B_MEMO), db.memos_backup[0]));
  assert.equal(db.memos.length, 3);
});

test('사본 해시가 내용과 다르면 쓰지 않고 409', async () => {
  db.memos_backup[0].body = '사본이 몰래 바뀜';
  const before = snapshot();
  const res = await restore({ id: B_MEMO });
  assert.equal(res.statusCode, 409);
  assert.equal(snapshot(), before);
});

test('B가 A 메모 ID로 요청하면 404이고 A 메모는 그대로', async () => {
  const before = snapshot();
  assert.equal((await restore({ id: A_MEMO })).statusCode, 404);
  assert.equal(snapshot(), before);
});

test('잘못된 요청은 쓰지 않음: 비로그인 401, GET 405, 본문 형식 400', async () => {
  const before = snapshot();
  assert.equal((await restore({ id: B_MEMO }, { user: null })).statusCode, 401);
  assert.equal((await restore({ id: B_MEMO }, { method: 'GET' })).statusCode, 405);
  assert.equal((await restore({ id: 'not-a-uuid' })).statusCode, 400);
  assert.equal((await restore({ id: B_MEMO, owner_id: B })).statusCode, 400);
  assert.equal((await restore({ id: B_MEMO, body: '바꿔치기' })).statusCode, 400);
  assert.equal(snapshot(), before);
});
