import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { POLICY_FILES, SNAPSHOT_SCHEMA, sha256, snapshotVersion } from '../scripts/policy-diff.mjs';

const script = fileURLToPath(new URL('../scripts/policy-diff.mjs', import.meta.url));
const baseContent = (path) => `// ${path}\nline-a\nline-b\n`;

function makeRoot(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'policy-diff-'));
  for (const path of POLICY_FILES) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), overrides[path] ?? baseContent(path));
  }
  return root;
}

function makeSnapshot(mutate) {
  const files = Object.fromEntries(POLICY_FILES.map((path) => {
    const content = baseContent(path);
    return [path, { sha256: sha256(content), content }];
  }));
  const snap = { schema: SNAPSHOT_SCHEMA, version: snapshotVersion(files), createdAt: '2026-10-13T00:00:00.000Z', files };
  mutate?.(snap);
  const dir = mkdtempSync(join(tmpdir(), 'policy-snap-'));
  const file = join(dir, 'policy-snapshot.json');
  writeFileSync(file, JSON.stringify(snap));
  return file;
}

const run = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const snapshotHash = (root) => POLICY_FILES.map((p) => sha256(readFileSync(join(root, p), 'utf8'))).join();

test('사본이 없으면 중단하고 아무것도 만들지 않습니다', () => {
  const root = makeRoot();
  const result = run(['--root', root]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /중단: 안전 정책 사본이 없습니다/);
  assert.doesNotMatch(result.stdout, /복원할 버전/);
});

test('검증에 실패한 사본은 모두 중단합니다', () => {
  const root = makeRoot();
  const bad = {
    '내용 변조': (s) => { s.files['src/decider.mjs'].content += 'evil\n'; },
    '버전 변조': (s) => { s.version = '0000000'; },
    '파일 하나 빠짐': (s) => { delete s.files['vercel.json']; },
    '목록에 없는 파일 추가': (s) => { s.files['../outside.txt'] = { sha256: sha256('x'), content: 'x' }; },
    'schema 다름': (s) => { s.schema = 'other'; },
    '시각 오류': (s) => { s.createdAt = 'not-a-date'; },
  };
  for (const [name, mutate] of Object.entries(bad)) {
    const result = run(['--root', root, '--snapshot', makeSnapshot(mutate)]);
    assert.equal(result.status, 2, name);
    assert.match(result.stdout, /^중단: /, name);
    assert.doesNotMatch(result.stdout, /복원할 버전/, name);
  }
});

test('기대한 버전과 다르면 중단합니다', () => {
  const root = makeRoot();
  const result = run(['--root', root, '--snapshot', makeSnapshot(), '--expect-version', 'abcdef0']);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /기대한 버전 abcdef0/);
});

test('같으면 차이 없음, 달라지면 버전과 변경 범위가 상세 차이보다 먼저 나옵니다', () => {
  const snapshot = makeSnapshot();
  const same = run(['--root', makeRoot(), '--snapshot', snapshot]);
  assert.equal(same.status, 0);
  assert.match(same.stdout, /변경 범위: 변경 0개, 현재 없음 0개, 같음 6개/);
  assert.match(same.stdout, /차이가 없습니다/);

  const root = makeRoot({ 'src/decider.mjs': '// src/decider.mjs\nline-a\nline-X\nline-c\n' });
  rmSync(join(root, 'vercel.json'));
  const diff = run(['--root', root, '--snapshot', snapshot]);
  assert.equal(diff.status, 0);
  const out = diff.stdout;
  assert.match(out, /복원할 버전: [0-9a-f]{7} /);
  assert.match(out, /변경 범위: 변경 1개, 현재 없음 1개, 같음 4개/);
  assert.ok(out.indexOf('복원할 버전') < out.indexOf('변경 범위'));
  assert.ok(out.indexOf('변경 범위') < out.indexOf('--- src/decider.mjs'));
  assert.match(out, /- {4}3 {2}line-b/);
  assert.match(out, /\+ {4}3 {2}line-X/);
  assert.match(out, /현재 없음 vercel\.json/);
});

test('실행 뒤에도 정책 파일과 사본은 그대로이고 비밀처럼 보이는 값은 가려집니다', () => {
  const secret = 'sb_secret_' + 'a'.repeat(30);
  const root = makeRoot({ 'aleph.config.json': `${baseContent('aleph.config.json')}key=${secret}\n` });
  const snapshot = makeSnapshot();
  const beforeRoot = snapshotHash(root);
  const beforeSnap = readFileSync(snapshot, 'utf8');
  const result = run(['--root', root, '--snapshot', snapshot]);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, new RegExp(secret));
  assert.match(result.stdout, /\[가림\]/);
  assert.equal(snapshotHash(root), beforeRoot);
  assert.equal(readFileSync(snapshot, 'utf8'), beforeSnap);
});
