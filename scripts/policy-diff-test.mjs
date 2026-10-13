import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { POLICY_FILES, inspectPolicy } from './policy-diff.mjs';

// 연습용 사본을 임시 폴더에 만들어 정책 차이 보기를 확인합니다. 자료실 파일은 바꾸지 않습니다.
const root = resolve(import.meta.dirname, '..');
const git = (args, encoding = 'utf8') => execFileSync('git', ['-C', root, ...args], { encoding, windowsHide: true });
const snapshotOf = (ref) => {
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  const files = Object.fromEntries(POLICY_FILES.map(file => [file,
    createHash('sha256').update(git(['show', `${commit}:${file}`], 'buffer')).digest('hex')]));
  return { schema: 'student.policy-snapshot.v1', commit, label: git(['log', '-1', '--format=%s', commit]).trim(), files };
};

const dir = mkdtempSync(join(tmpdir(), 'policy-diff-'));
const write = (name, value) => {
  const path = join(dir, name);
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
  return path;
};

try {
  const head = snapshotOf('HEAD');
  const earlier = snapshotOf('HEAD~1');
  const tampered = { ...head, files: { ...head.files, 'src/decider.mjs': '0'.repeat(64) } };
  const cases = [
    { name: '사본 없음', path: join(dir, 'none.json'), expect: r => !r.ok && r.stage === 'missing' },
    { name: 'JSON이 아닌 사본', path: write('broken.json', '{'), expect: r => !r.ok && r.stage === 'invalid' },
    { name: '형식 밖 항목이 붙은 사본', path: write('extra.json', { ...head, token: 'x' }),
      expect: r => !r.ok && r.stage === 'invalid' },
    { name: '지문이 바뀐 사본', path: write('tampered.json', tampered), expect: r => !r.ok && r.stage === 'unverified' },
    { name: '자료실에 없는 커밋', path: write('unknown.json', { ...head, commit: 'f'.repeat(40) }),
      expect: r => !r.ok && r.stage === 'unverified' },
    { name: '이름이 커밋과 다른 사본', path: write('label.json', { ...head, label: '가짜 저장점' }),
      expect: r => !r.ok && r.stage === 'unverified' },
    { name: `검증된 사본 ${head.commit.slice(0, 7)}(현재와 같음)`, path: write('head.json', head),
      expect: r => r.ok && r.version.commit === head.commit },
    { name: `검증된 사본 ${earlier.commit.slice(0, 7)}(이전 저장점)`, path: write('earlier.json', earlier),
      expect: r => r.ok && r.version.label === earlier.label && r.changes.length > 0 },
  ];
  let failed = false;
  for (const item of cases) {
    const result = inspectPolicy(item.path);
    const passed = item.expect(result);
    failed ||= !passed;
    const detail = result.ok ? `버전 ${result.version.commit.slice(0, 7)}, 바뀐 파일 ${result.changes.length}개` : result.reason;
    process.stdout.write(`${passed ? '통과' : '확인 필요'} · ${item.name} → ${detail}\n`);
  }
  process.stdout.write('임시 사본으로 한 연습이며 실제 복원이나 심판 판정이 아닙니다.\n');
  if (failed) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
