import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SNAPSHOT, POLICY_FILES, REPO_ROOT, formatReport, gitIn, inspectPolicy } from './policy-diff.mjs';

// 10단계: 검증한 안전 정책 사본의 버전으로 시험 정책 파일만 되돌립니다.
// --confirm에 화면에 나온 버전(커밋 앞 7자리)을 적어야만 파일을 씁니다. 그 전에는 계획만 보여 줍니다.
// 정책 파일 밖의 파일(다른 서비스 규칙), Git 기록, 감사 기록은 바꾸지 않습니다. 커밋·push·배포도 하지 않습니다.
export const AUDIT_LOG = 'backup/restore-audit.jsonl';
export const REPLACED_DIR = 'backup/replaced';
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

export function planRestore({ snapshotPath = DEFAULT_SNAPSHOT, files, root = REPO_ROOT } = {}) {
  if (files !== undefined && (!Array.isArray(files) || !files.length
      || files.some(file => !POLICY_FILES.includes(file)))) {
    return { ok: false, stage: 'invalid', reason: `되돌릴 파일은 정책 파일 중에서만 고를 수 있습니다: ${POLICY_FILES.join(', ')}` };
  }
  const inspected = inspectPolicy(snapshotPath, root);
  if (!inspected.ok) return inspected;
  const chosen = files ?? POLICY_FILES;
  const targets = inspected.changes.filter(item => chosen.includes(item.file));
  return { ...inspected, targets };
}

export function formatPlan(plan) {
  if (!plan.ok) return formatReport(plan);
  const short = plan.version.commit.slice(0, 7);
  const lines = [formatReport(plan).replace(/\n보여 주기만 했습니다\.[^\n]*\n$/u, '\n').trimEnd(), ''];
  if (!plan.targets.length) {
    lines.push('되돌릴 항목: 없음');
  } else {
    lines.push(`되돌릴 항목 (${plan.targets.length}개, 사본 ${short}의 내용으로 바뀜):`);
    for (const item of plan.targets) lines.push(`  ${item.file}  (현재 쪽 +${item.added} -${item.removed}줄이 사라짐)`);
    const kept = plan.changes.filter(item => !plan.targets.includes(item));
    if (kept.length) lines.push(`그대로 둘 정책 파일: ${kept.map(item => item.file).join(', ')}`);
  }
  lines.push('바꾸지 않는 것: 정책 파일 밖의 파일(공지·로그인·AI·xdr 등), Git 기록, 감사 기록의 이전 줄, 운영 정책과 배포.');
  return `${lines.join('\n')}\n`;
}

// confirm이 화면에 나온 버전과 같을 때만 씁니다. 바뀌기 전 내용은 backup/replaced/<시각>/에 남기고,
// 감사 기록에는 한 줄을 덧붙이기만 합니다(이전 줄은 지우거나 고치지 않음).
export function applyRestore(plan, confirm, { root = REPO_ROOT, now = new Date() } = {}) {
  if (!plan.ok) return { ok: false, reason: plan.reason };
  if (!plan.targets.length) return { ok: true, restored: [] };
  const short = plan.version.commit.slice(0, 7);
  if (confirm !== short) {
    return { ok: false, reason: `확인 값이 없거나 버전과 다릅니다. 위 내용을 확인했다면 --confirm ${short}를 붙여 다시 실행하세요.` };
  }
  const git = gitIn(root);
  const stamp = now.toISOString().replace(/[:.]/gu, '-');
  const records = [];
  for (const { file } of plan.targets) {
    const path = resolve(root, file);
    const before = existsSync(path) ? readFileSync(path) : null;
    if (before) {
      const saved = resolve(root, REPLACED_DIR, stamp, file);
      mkdirSync(dirname(saved), { recursive: true });
      writeFileSync(saved, before, { flag: 'wx' });
    }
    // 작업 폴더 형식(줄바꿈 설정)을 따르는 내용으로 씁니다.
    writeFileSync(path, git(['cat-file', '--filters', `${plan.version.commit}:${file}`], 'buffer'));
    const expected = git(['rev-parse', `${plan.version.commit}:${file}`]).trim();
    const actual = git(['hash-object', '--', file]).trim();
    if (actual !== expected) return { ok: false, reason: `${file}을 되돌린 뒤 내용이 사본과 다릅니다. 멈췄습니다.` };
    records.push({ file, beforeSha256: before ? sha256(before) : null, restoredBlob: expected });
  }
  const audit = resolve(root, AUDIT_LOG);
  mkdirSync(dirname(audit), { recursive: true });
  appendFileSync(audit, `${JSON.stringify({ at: now.toISOString(), action: 'policy_restore',
    version: plan.version.commit, label: plan.version.label, files: records, replacedDir: `${REPLACED_DIR}/${stamp}` })}\n`);
  return { ok: true, restored: records.map(item => item.file), replacedDir: `${REPLACED_DIR}/${stamp}` };
}

const option = (name) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filesArg = option('--files');
  const plan = planRestore({ snapshotPath: option('--snapshot') ?? DEFAULT_SNAPSHOT,
    files: filesArg ? filesArg.split(',').map(file => file.trim()) : undefined });
  process.stdout.write(formatPlan(plan));
  const confirm = option('--confirm');
  if (!plan.ok) {
    process.exitCode = 1;
  } else if (confirm === undefined) {
    if (plan.targets.length) process.stdout.write(`\n아직 아무 파일도 바꾸지 않았습니다. 되돌리려면 --confirm ${plan.version.commit.slice(0, 7)}를 붙여 다시 실행하세요.\n`);
  } else {
    const result = applyRestore(plan, confirm);
    if (!result.ok) {
      process.stdout.write(`\n중단: ${result.reason}\n`);
      process.exitCode = 1;
    } else if (result.restored.length) {
      process.stdout.write(`\n되돌림: ${result.restored.join(', ')}\n바뀌기 전 내용: ${result.replacedDir}/\n감사 기록에 한 줄 추가: ${AUDIT_LOG}\n커밋·push·배포는 하지 않았습니다.\n`);
    }
  }
}
