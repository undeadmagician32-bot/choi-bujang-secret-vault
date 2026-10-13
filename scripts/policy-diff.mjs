import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 10단계: 침해 전에 검증한 안전 정책 사본과 현재 시험 정책(작업 폴더)의 차이만 보여 줍니다.
// 파일을 쓰거나 되돌리지 않고, 배포 주소·운영 정책·네트워크에는 요청하지 않습니다.
// 사본 형식은 학생이 정한 것이며 운영 측 계약이 아닙니다.
export const REPO_ROOT = resolve(import.meta.dirname, '..');
export const DEFAULT_SNAPSHOT = 'backup/policy-snapshot.json';
// 메모 서비스의 접근 규칙(소유자 검사 포함)과 판정·탐지·자원 규칙만 정책으로 봅니다.
// 공지·로그인·AI·xdr 같은 다른 서비스 파일과 문서는 사본·되돌리기 대상이 아닙니다.
export const POLICY_FILES = Object.freeze(['api/memos/[id].js', 'api/memos/index.js', 'src/decider.mjs',
  'src/detect.mjs', 'src/memo-api.mjs', 'src/resources.mjs']);
// [id] 같은 글자를 패턴이 아닌 파일 이름 그대로 비교합니다.
export const LITERAL_PATHS = POLICY_FILES.map(file => `:(literal)${file}`);
const SNAPSHOT_KEYS = 'commit,files,label,schema';
const SCHEMA = 'student.policy-snapshot.v1';
const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const MAX_SNAPSHOT_BYTES = 64 * 1024;

export const gitIn = (root) => (args, encoding = 'utf8') => execFileSync('git', ['-C', root, ...args], {
  encoding, timeout: 5000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
});
const gitOkIn = (git) => (args) => { try { git(args); return true; } catch { return false; } };
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stop = (stage, reason) => ({ ok: false, stage, reason });

// 사본을 읽고 검증합니다. 하나라도 맞지 않으면 차이를 계산하지 않고 중단 결과를 돌려줍니다.
export function verifySnapshot(snapshotPath = DEFAULT_SNAPSHOT, root = REPO_ROOT) {
  const git = gitIn(root);
  const gitOk = gitOkIn(git);
  const path = resolve(root, snapshotPath);
  let snapshot;
  try {
    const info = statSync(path);
    if (!info.isFile()) return stop('missing', `안전 정책 사본이 파일이 아닙니다: ${snapshotPath}`);
    if (info.size > MAX_SNAPSHOT_BYTES) return stop('invalid', '안전 정책 사본이 너무 큽니다.');
    snapshot = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return stop('missing', `안전 정책 사본이 없습니다: ${snapshotPath}`);
    return stop('invalid', '안전 정책 사본을 JSON으로 읽을 수 없습니다.');
  }
  if (!isPlainObject(snapshot) || Object.keys(snapshot).sort().join(',') !== SNAPSHOT_KEYS
      || snapshot.schema !== SCHEMA || !COMMIT.test(snapshot.commit ?? '')
      || typeof snapshot.label !== 'string' || !isPlainObject(snapshot.files)
      || Object.keys(snapshot.files).sort().join(',') !== POLICY_FILES.join(',')
      || !Object.values(snapshot.files).every(hash => typeof hash === 'string' && SHA256.test(hash))) {
    return stop('invalid', '안전 정책 사본의 형식이 다릅니다(항목·커밋·지문 형식 확인).');
  }
  const { commit, label, files } = snapshot;
  if (!gitOk(['cat-file', '-e', `${commit}^{commit}`])) {
    return stop('unverified', `사본의 커밋 ${commit.slice(0, 7)}이 이 자료실에 없습니다.`);
  }
  // 침해 전에 올려 둔 저장점인지: 마지막으로 받아 온 origin/main 기록 안에 있어야 합니다.
  if (!gitOk(['merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main'])) {
    return stop('unverified', `사본의 커밋 ${commit.slice(0, 7)}이 origin/main 기록에 없습니다.`);
  }
  const subject = git(['log', '-1', '--format=%s', commit]).trim();
  if (subject !== label) {
    return stop('unverified', `사본의 이름 「${label}」이 커밋 제목 「${subject}」과 다릅니다.`);
  }
  for (const file of POLICY_FILES) {
    let actual;
    try {
      actual = createHash('sha256').update(git(['show', `${commit}:${file}`], 'buffer')).digest('hex');
    } catch {
      return stop('unverified', `사본 커밋에 ${file}이 없습니다.`);
    }
    if (actual !== files[file]) return stop('unverified', `${file}의 지문이 사본에 적힌 값과 다릅니다.`);
  }
  return { ok: true, commit, label };
}

// 검증된 사본 커밋과 현재 작업 폴더의 정책 파일 차이를 계산합니다(읽기만 함).
export function inspectPolicy(snapshotPath = DEFAULT_SNAPSHOT, root = REPO_ROOT) {
  const git = gitIn(root);
  const verified = verifySnapshot(snapshotPath, root);
  if (!verified.ok) return verified;
  const numstat = git(['diff', '--no-color', '--no-ext-diff', '--numstat', verified.commit, '--', ...LITERAL_PATHS]);
  const changes = numstat.split(/\r?\n/u).filter(Boolean).map((line) => {
    const [added, removed, file] = line.split('\t');
    return { file, added: Number(added), removed: Number(removed) };
  });
  const diff = changes.length
    ? git(['diff', '--no-color', '--no-ext-diff', verified.commit, '--', ...LITERAL_PATHS]) : '';
  return { ok: true, version: { commit: verified.commit, label: verified.label }, changes, diff };
}

export function formatReport(result) {
  if (!result.ok) return `중단: ${result.reason}\n차이를 계산하지 않았고 아무 파일도 바꾸지 않았습니다.\n`;
  const { version, changes, diff } = result;
  const lines = [
    `복원할 버전: ${version.commit.slice(0, 7)} 「${version.label}」`,
    `사본 검증: 통과 (정책 파일 ${POLICY_FILES.length}개 지문 일치, origin/main 기록에 있음)`,
  ];
  if (!changes.length) {
    lines.push('변경 범위: 없음 (현재 시험 정책이 사본과 같습니다)');
  } else {
    const added = changes.reduce((sum, item) => sum + item.added, 0);
    const removed = changes.reduce((sum, item) => sum + item.removed, 0);
    lines.push(`변경 범위: 파일 ${changes.length}개, 현재 쪽 +${added}줄 / -${removed}줄`);
    for (const item of changes) lines.push(`  ${item.file}  +${item.added} -${item.removed}`);
    lines.push('', '--- 사본(복원할 버전) / +++ 현재 시험 정책', diff.trimEnd());
  }
  lines.push('', '보여 주기만 했습니다. 파일 복원, 운영 정책 변경, 배포는 하지 않았습니다.');
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--snapshot');
  const snapshotPath = at > 0 && process.argv[at + 1] ? process.argv[at + 1] : DEFAULT_SNAPSHOT;
  const result = inspectPolicy(snapshotPath);
  process.stdout.write(formatReport(result));
  if (!result.ok) process.exitCode = 1;
}
