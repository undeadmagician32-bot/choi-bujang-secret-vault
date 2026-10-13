import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POLICY_FILES, PolicyDiffAbort, comparePolicies, loadSnapshot, parseOptions, renderReport, sha256,
} from './policy-diff.mjs';

// 검증한 정책 사본의 버전으로 시험 정책 파일(POLICY_FILES 여섯 개)만 되돌립니다.
// - 실행 전에 복원할 버전과 바뀔 파일을 보여 주고, --confirm <버전>을 적어야만 씁니다.
// - 여섯 개 밖의 파일(다른 서비스 규칙 포함)은 읽거나 쓰지 않습니다.
// - 감사 기록(backup/policy-restore-audit.log)은 한 줄 덧붙이기만 하고 기존 기록은 건드리지 않습니다.
// - 바뀌기 전 내용은 backup/pre-restore/<시각>/ 아래에 남깁니다.
export const AUDIT_FILE = 'backup/policy-restore-audit.log';
const abort = (message) => { throw new PolicyDiffAbort(message); };

export function preview(snap, results) {
  const todo = results.filter((r) => r.status !== 'same');
  const lines = [
    renderReport(snap, results).split('\n--- ')[0],
    '',
    todo.length
      ? `되돌릴 파일 ${todo.length}개: ${todo.map((r) => r.path).join(', ')}`
      : '되돌릴 파일이 없습니다. 현재 정책이 사본과 같습니다.',
    `그대로 두는 것: 정책 파일 여섯 개 밖의 모든 파일(다른 서비스 규칙 포함), 그리고 ${AUDIT_FILE}의 기존 기록(한 줄 덧붙이기만 합니다)`,
    '바뀌기 전 내용은 backup/pre-restore/ 아래에 남깁니다.',
  ];
  return lines.join('\n');
}

function apply(snap, results, root) {
  const todo = results.filter((r) => r.status !== 'same');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const saveDir = join(root, 'backup', 'pre-restore', stamp);
  // 1) 쓰기 전에 바뀌기 전 내용을 모두 남깁니다. 여기서 실패하면 아무 정책 파일도 바꾸지 않습니다.
  for (const r of todo) {
    const current = join(root, r.path);
    if (!existsSync(current)) continue;
    mkdirSync(dirname(join(saveDir, r.path)), { recursive: true });
    writeFileSync(join(saveDir, r.path), readFileSync(current));
  }
  // 2) 사본 내용을 쓰고 다시 읽어 해시가 같은지 확인합니다.
  const done = [];
  let failure = null;
  for (const r of todo) {
    try {
      const target = join(root, r.path);
      const before = existsSync(target) ? sha256(readFileSync(target, 'utf8')) : null;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, snap.files[r.path].content);
      const after = sha256(readFileSync(target, 'utf8'));
      if (after !== snap.files[r.path].sha256) throw new Error('verify');
      done.push({ path: r.path, beforeSha256: before, afterSha256: after });
    } catch {
      failure = r.path;
      break;
    }
  }
  // 3) 감사 기록은 결과와 상관없이 한 줄 덧붙입니다(내용은 적지 않고 해시만 적습니다).
  mkdirSync(join(root, 'backup'), { recursive: true });
  appendFileSync(join(root, AUDIT_FILE), `${JSON.stringify({
    at: new Date().toISOString(), action: 'policy_restore', version: snap.version,
    outcome: failure ? 'failed' : 'restored', failedAt: failure, files: done,
    preRestoreDir: `backup/pre-restore/${stamp}`,
  })}\n`);
  if (failure) abort(`${failure}을 되돌리는 중 실패했습니다. 앞선 ${done.length}개만 되돌려졌습니다. 바뀌기 전 내용은 backup/pre-restore/${stamp}/에 있습니다.`);
  return { done, stamp };
}

export function run(argv) {
  const opts = parseOptions(argv, ['--snapshot', '--root', '--expect-version', '--confirm']);
  const root = resolve(opts.root ?? fileURLToPath(new URL('..', import.meta.url)));
  const snap = loadSnapshot(resolve(opts.snapshot ?? join(root, 'backup', 'policy-snapshot.json')), opts['expect-version']);
  const results = comparePolicies(snap, root);
  const shown = preview(snap, results);
  const todo = results.filter((r) => r.status !== 'same');
  if (opts.confirm === undefined) {
    return `${shown}\n\n아직 아무것도 바꾸지 않았습니다. 위 버전과 파일이 맞으면 다음 명령을 실행하세요.\nnpm run policy:restore -- --confirm ${snap.version}`;
  }
  if (opts.confirm !== snap.version) abort(`확인한 버전 ${opts.confirm}이 복원할 버전 ${snap.version}과 다릅니다. 아무것도 바꾸지 않았습니다.`);
  if (todo.length === 0) return `${shown}\n\n되돌릴 것이 없어 아무것도 바꾸지 않았습니다.`;
  const { done, stamp } = apply(snap, results, root);
  return `${shown}\n\n되돌림 완료: 버전 ${snap.version}, 파일 ${done.length}개. 바뀌기 전 내용: backup/pre-restore/${stamp}/\n다음으로 npm run policy:diff 가 「변경 범위: 변경 0개, 현재 없음 0개」인지 확인하세요.`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (error) {
    console.log(`중단: ${error instanceof PolicyDiffAbort ? error.message : '예상하지 못한 오류가 났습니다.'}`);
    process.exitCode = 2;
  }
}
