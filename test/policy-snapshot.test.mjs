import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { POLICY_FILES, loadSnapshot, parseOptions, sha256 } from '../scripts/policy-diff.mjs';

const scripts = (name) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
const run = (name, ...args) => spawnSync(process.execPath, [scripts(name), ...args], { encoding: 'utf8' });

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'policy-snap-'));
  for (const path of POLICY_FILES) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `// ${path}\nline-a\n`);
  }
  return root;
}
const hashes = (root) => POLICY_FILES.map((p) => sha256(readFileSync(join(root, p), 'utf8'))).join();
const versionOf = (out) => /만들 사본 버전: ([0-9a-f]{7})/.exec(out)[1];

test('--confirm 없이는 미리보기만 하고 아무것도 쓰지 않습니다', () => {
  const root = makeRoot();
  const before = hashes(root);
  const result = run('policy-snapshot.mjs', '--root', root);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /아직 아무것도 쓰지 않았습니다/);
  assert.match(result.stdout, /npm run policy:snapshot -- --confirm [0-9a-f]{7}/);
  assert.equal(existsSync(join(root, 'backup', 'policy-snapshot.json')), false);
  assert.equal(hashes(root), before);
});

test('잘못된 버전은 중단하고, 맞는 버전이면 검증되는 사본을 만들며 정책 파일은 그대로입니다', () => {
  const root = makeRoot();
  const before = hashes(root);
  const version = versionOf(run('policy-snapshot.mjs', '--root', root).stdout);
  const wrong = run('policy-snapshot.mjs', '--root', root, '--confirm', 'abcdef0');
  assert.equal(wrong.status, 2);
  assert.match(wrong.stdout, /다릅니다\. 아무것도 쓰지 않았습니다/);
  assert.equal(existsSync(join(root, 'backup', 'policy-snapshot.json')), false);

  const made = run('policy-snapshot.mjs', '--root', root, `--confirm=${version}`);
  assert.equal(made.status, 0);
  assert.match(made.stdout, /사본을 만들었습니다/);
  const file = join(root, 'backup', 'policy-snapshot.json');
  assert.equal(loadSnapshot(file, version).version, version);
  assert.equal(hashes(root), before);
  // 사본을 만든 직후 차이는 없습니다.
  assert.match(run('policy-diff.mjs', '--root', root, `--expect-version=${version}`).stdout, /변경 범위: 변경 0개, 현재 없음 0개, 같음 6개/);
});

test('사본이 이미 있으면 덮어쓰지 않고 중단합니다', () => {
  const root = makeRoot();
  const version = versionOf(run('policy-snapshot.mjs', '--root', root).stdout);
  assert.equal(run('policy-snapshot.mjs', '--root', root, '--confirm', version).status, 0);
  const file = join(root, 'backup', 'policy-snapshot.json');
  const first = readFileSync(file, 'utf8');
  writeFileSync(join(root, 'src/decider.mjs'), '// 바뀜\n');
  const again = run('policy-snapshot.mjs', '--root', root, '--confirm', versionOf(run('policy-snapshot.mjs', '--root', makeRoot()).stdout));
  assert.equal(again.status, 2);
  assert.match(again.stdout, /이미 있습니다\. 덮어쓰지 않습니다/);
  assert.equal(readFileSync(file, 'utf8'), first);
});

test('정책 파일이 하나라도 없으면 중단합니다', () => {
  const root = makeRoot();
  writeFileSync(join(root, 'vercel.json'), '');
  const gone = makeRoot();
  // 빈 파일은 허용되지만 없는 파일은 허용되지 않습니다.
  assert.equal(run('policy-snapshot.mjs', '--root', root).status, 0);
  assert.equal(run('policy-snapshot.mjs', '--root', join(gone, 'nowhere')).status, 2);
});

test('--옵션=값 형식을 정책 되돌리기도 받습니다', () => {
  const root = makeRoot();
  const version = versionOf(run('policy-snapshot.mjs', '--root', root).stdout);
  assert.equal(run('policy-snapshot.mjs', '--root', root, '--confirm', version).status, 0);
  writeFileSync(join(root, 'src/decider.mjs'), '// 침해됨\n');
  const restored = run('policy-restore.mjs', '--root', root, `--confirm=${version}`);
  assert.equal(restored.status, 0);
  assert.match(restored.stdout, /되돌림 완료: 버전 \w{7}, 파일 1개/);
  assert.equal(readFileSync(join(root, 'src/decider.mjs'), 'utf8'), '// src/decider.mjs\nline-a\n');
});

test('옵션 해석: 두 꼴 모두 받고, 모르는 옵션·값 없음·중복은 중단합니다', () => {
  const allowed = ['--confirm', '--root'];
  assert.deepEqual(parseOptions(['--confirm', 'abc1234', '--root=/x'], allowed), { confirm: 'abc1234', root: '/x' });
  for (const bad of [['--other', 'x'], ['--confirm'], ['--confirm='], ['--confirm', 'a', '--confirm=b']]) {
    assert.throws(() => parseOptions(bad, allowed), /옵션/, JSON.stringify(bad));
  }
});
