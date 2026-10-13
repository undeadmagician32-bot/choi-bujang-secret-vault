import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, mock, test } from 'node:test';
import { pathToFileURL } from 'node:url';

// 10단계 되돌리기 연습: 자료실을 임시 폴더에 복제해 침해(소유자 검사 삭제)를 흉내 낸 뒤 되돌립니다.
// 실제 자료실 파일, Supabase, 배포에는 손대지 않습니다. 로그인과 DB는 가짜이며 심판 판정이 아닙니다.
const root = resolve(import.meta.dirname, '..');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const A_MEMO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let clone;
let rows;
let loads = 0;

const git = (args, cwd = clone) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const run = (args) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['scripts/policy-restore.mjs', ...args],
      { cwd: clone, encoding: 'utf8', windowsHide: true }) };
  } catch (error) {
    return { code: error.status, out: error.stdout };
  }
};

class FakeQuery {
  constructor() { this.op = 'select'; this.filters = []; this.single = false; }
  select() { return this; }
  update(values) { this.op = 'update'; this.values = values; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(key, value) { this.filters.push([key, value]); return this; }
  order() { return this; }
  maybeSingle() { this.single = true; return this; }
  then(resolve, reject) {
    const matched = rows.filter(row => this.filters.every(([key, value]) => row[key] === value));
    let data;
    if (this.op === 'select') data = this.single ? (matched[0] ?? null) : matched.map(row => ({ ...row }));
    if (this.op === 'update') { for (const row of matched) Object.assign(row, this.values); data = matched.map(row => ({ id: row.id })); }
    if (this.op === 'delete') { rows = rows.filter(row => !matched.includes(row)); data = matched.map(row => ({ id: row.id })); }
    return Promise.resolve({ data, error: null }).then(resolve, reject);
  }
}

async function call(user, method, body) {
  const { default: handler } = await import(`${pathToFileURL(join(clone, 'api/memos/[id].js')).href}?v=${loads++}`);
  const response = { statusCode: 0, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; } };
  await handler({ method, query: { id: A_MEMO }, headers: { authorization: `Bearer ${user}` }, body }, response);
  return response.statusCode;
}

const reset = () => { rows = [{ id: A_MEMO, owner_id: A, title: '가상 메모', body: 'SAMPLE', created_at: '2026-10-01' }]; };

before(() => {
  clone = mkdtempSync(join(tmpdir(), 'policy-restore-'));
  execFileSync('git', ['clone', '--quiet', root, clone], { windowsHide: true });
  symlinkSync(join(root, 'node_modules'), join(clone, 'node_modules'), 'junction');
  for (const file of ['scripts/policy-diff.mjs', 'scripts/policy-restore.mjs']) copyFileSync(join(root, file), join(clone, file));
  mock.module(pathToFileURL(join(clone, 'src/verify-login.mjs')).href, { exports: {
    createLoginVerifier: () => async header => (header === 'Bearer a' ? { userId: A } : header === 'Bearer b' ? { userId: B } : null) } });
  mock.module('@supabase/supabase-js', { exports: { createClient: () => ({ from: () => new FakeQuery() }) } });
  process.env.SUPABASE_URL = 'https://fake.invalid';
  process.env.SUPABASE_SECRET_KEY = 'fake-test-only';
  mock.method(console, 'warn', () => {});
  // 침해 전 저장점(HEAD)으로 안전 정책 사본을 만듭니다.
  const commit = git(['rev-parse', 'HEAD']);
  const POLICY = ['api/memos/[id].js', 'api/memos/index.js', 'src/decider.mjs', 'src/detect.mjs', 'src/memo-api.mjs', 'src/resources.mjs'];
  const files = Object.fromEntries(POLICY.map(file => [file, createHash('sha256')
    .update(execFileSync('git', ['-C', clone, 'show', `${commit}:${file}`])).digest('hex')]));
  mkdirSync(join(clone, 'backup'), { recursive: true });
  writeFileSync(join(clone, 'backup/policy-snapshot.json'), JSON.stringify({ schema: 'student.policy-snapshot.v1',
    commit, label: git(['log', '-1', '--format=%s', commit]), files }));
  writeFileSync(join(clone, 'backup/restore-audit.jsonl'), '{"at":"2026-10-01T00:00:00.000Z","action":"earlier_record"}\n');
});

after(() => { if (clone) rmSync(clone, { recursive: true, force: true }); });

test('침해 → 계획 확인 → 되돌리기 뒤 B의 A 메모 요청은 다시 거부, A 정상 요청은 유지', async () => {
  reset();
  assert.equal(await call('a', 'GET'), 200, '침해 전 A 자기 메모');
  assert.equal(await call('b', 'GET'), 404, '침해 전 B의 A 메모');

  // 침해 흉내: 소유자 검사를 지우고, 다른 서비스 파일에도 표시를 남깁니다.
  const idFile = join(clone, 'api/memos/[id].js');
  writeFileSync(idFile, readFileSync(idFile, 'utf8').replaceAll(".eq('id', id).eq('owner_id', userId)", ".eq('id', id)"));
  const notesFile = join(clone, 'api/notes.js');
  writeFileSync(notesFile, `${readFileSync(notesFile, 'utf8')}\n// other-service-marker\n`);
  reset();
  assert.equal(await call('b', 'GET'), 200, '침해 뒤 B가 A 메모를 읽음(되돌리기 전 상태 확인)');

  const head = git(['rev-parse', 'HEAD']);
  const plan = run([]);
  assert.equal(plan.code, 0);
  assert.match(plan.out, new RegExp(`복원할 버전: ${head.slice(0, 7)}`));
  assert.match(plan.out, /되돌릴 항목 \(1개.*\n {2}api\/memos\/\[id\]\.js/u);
  assert.match(plan.out, /아직 아무 파일도 바꾸지 않았습니다/u);
  assert.equal(run(['--confirm', '0000000']).code, 1, '틀린 확인 값은 중단');
  reset();
  assert.equal(await call('b', 'GET'), 200, '확인 전에는 파일이 그대로');

  const done = run(['--confirm', head.slice(0, 7)]);
  assert.equal(done.code, 0, done.out);
  assert.match(done.out, /되돌림: api\/memos\/\[id\]\.js/u);

  reset();
  assert.equal(await call('b', 'GET'), 404, 'B의 A 메모 읽기 거부');
  assert.equal(await call('b', 'PUT', { title: 't', body: 'b' }), 404, 'B의 A 메모 수정 거부');
  assert.equal(await call('b', 'DELETE'), 404, 'B의 A 메모 삭제 거부');
  assert.equal(await call('a', 'GET'), 200, 'A 자기 메모 읽기');
  assert.equal(await call('a', 'PUT', { title: '고친 제목', body: 'SAMPLE' }), 200, 'A 자기 메모 수정');

  assert.match(readFileSync(notesFile, 'utf8'), /other-service-marker/u, '다른 서비스 파일 보존');
  const audit = readFileSync(join(clone, 'backup/restore-audit.jsonl'), 'utf8').trim().split('\n');
  assert.equal(audit.length, 2);
  assert.match(audit[0], /earlier_record/u, '이전 감사 기록 보존');
  assert.match(audit[1], /policy_restore/u);
  assert.equal(git(['rev-parse', 'HEAD']), head, 'Git 기록 그대로');
  assert.equal(git(['status', '--porcelain', '--', ':(literal)api/memos/[id].js']), '', '되돌린 파일이 사본 버전과 같음');
  assert.equal(run([]).out.includes('되돌릴 항목: 없음'), true);
});
