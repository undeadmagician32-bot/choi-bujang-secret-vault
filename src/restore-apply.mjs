// 10단계 제작 2: 검증한 정책 사본의 값으로 aleph.config.json의 정책 항목만 되돌립니다.
// 실행하려면 먼저 `npm run restore:plan`으로 바뀔 항목을 보고, 거기 적힌 확인 번호를 그대로 넘겨야 합니다.
// 건드리는 곳: allowedRoutes, identityProvider, originalApiUrl. 그 밖의 설정 항목, 코드, 감사 기록은 지우거나 고치지 않습니다.
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { RestoreAbort, diffPolicy, isCodeChange, loadSnapshot, planRestore, readCurrentPolicy, DEFAULT_SNAPSHOT_PATH }
  from './restore-plan.mjs';

export const AUDIT_PATH = 'restore/audit.log';
const CONFIG_FIELDS = ['allowedRoutes', 'identityProvider', 'originalApiUrl'];

async function writeFileAtomic(path, text) {
  const temp = `${path}.restore-tmp`;
  await writeFile(temp, text, 'utf8');
  await rename(temp, path);
}

export async function applyRestore({ root, snapshotPath = join(root, DEFAULT_SNAPSHOT_PATH), confirmPlanId, now = () => new Date() }) {
  const plan = await planRestore({ root, snapshotPath });
  if (typeof confirmPlanId !== 'string' || confirmPlanId !== plan.planId) {
    throw new RestoreAbort('PLAN_NOT_CONFIRMED',
      '확인 번호가 없거나 보여 준 계획과 다릅니다. npm run restore:plan을 다시 실행해 바뀔 항목을 확인하세요.');
  }
  if (plan.changes.some(isCodeChange)) {
    throw new RestoreAbort('CODE_POLICY_DIFFERS',
      '규칙 이름(ruleIds)이 사본과 다릅니다. 이 항목은 src/decider.mjs 코드에 있어 자동 복원하지 않습니다. 코드를 사본과 맞춘 뒤 다시 하세요.');
  }
  if (!plan.changes.length) return { applied: false, plan };

  const snapshot = await loadSnapshot(snapshotPath);
  const configPath = join(root, 'aleph.config.json');
  const beforeText = await readFile(configPath, 'utf8');
  const config = JSON.parse(beforeText);
  const others = Object.fromEntries(Object.entries(config).filter(([key]) => !CONFIG_FIELDS.includes(key)));
  for (const field of CONFIG_FIELDS) config[field] = structuredClone(snapshot.policy[field]);

  const auditPath = join(root, AUDIT_PATH);
  try {
    await writeFileAtomic(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const after = JSON.parse(await readFile(configPath, 'utf8'));
    const rest = Object.fromEntries(Object.entries(after).filter(([key]) => !CONFIG_FIELDS.includes(key)));
    if (!isDeepStrictEqual(rest, others)) throw new Error('OTHER_SETTINGS_CHANGED');
    if (diffPolicy(snapshot.policy, await readCurrentPolicy(root)).length) throw new Error('RESTORE_NOT_MATCHING');
    // 감사 기록은 덧붙이기만 합니다. 값 자체가 아니라 바뀐 항목 이름만 남깁니다.
    await mkdir(dirname(auditPath), { recursive: true });
    await appendFile(auditPath, `${JSON.stringify({ at: now().toISOString(), event: 'policy_restore',
      version: plan.version, snapshotDigest: plan.digest, planId: plan.planId,
      changed: [...new Set(plan.changes.map((c) => c.path))] })}\n`, 'utf8');
  } catch (error) {
    await writeFileAtomic(configPath, beforeText);
    throw new RestoreAbort('RESTORE_FAILED', `복원이 실패해 설정을 원래대로 돌렸습니다 (${error.message}).`);
  }
  return { applied: true, plan };
}

// 복원 뒤 로컬 점검. 심판의 판정이 아니며 실제 배포에 보낸 요청이 아닙니다.
// A의 정상 요청은 판정기 가상 요청으로, B의 A 자료 요청은 서버 코드의 소유자 조건(.eq('owner_id', …))이 남아 있는지로만 봅니다.
export async function checkAfterRestore({ root, decide, fixtureRequests, config }) {
  const { normal } = fixtureRequests();
  const results = [];
  const allow = await decide(normal);
  results.push({ name: 'A의 정상 요청은 판정기에서 allow', passed: allow.decision === 'allow' });
  const unregistered = await decide({ ...normal, deviceRegistered: false });
  results.push({ name: '미등록 기기의 요청은 판정기에서 deny', passed: unregistered.decision === 'deny' });
  const routes = config.allowedRoutes ?? [];
  results.push({ name: '자료 경로가 사본의 허용 경로와 같음(GET /api/memos/:id 포함)',
    passed: routes.includes('GET /api/memos/:id') });
  for (const file of ['api/memos/[id].js', 'api/memos/index.js']) {
    const source = await readFile(join(root, file), 'utf8');
    results.push({ name: `${file}에 소유자 조건이 있음`, passed: source.includes(".eq('owner_id', userId)") });
  }
  return results;
}
