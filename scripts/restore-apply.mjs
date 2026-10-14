import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { RestoreAbort, formatPlan } from '../src/restore-plan.mjs';
import { applyRestore, checkAfterRestore } from '../src/restore-apply.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const confirm = args.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length);
const snapshot = args.find((a) => !a.startsWith('--'));

try {
  const result = await applyRestore({ root, confirmPlanId: confirm,
    ...(snapshot ? { snapshotPath: resolve(snapshot) } : {}) });
  console.log(formatPlan(result.plan));
  if (!result.applied) {
    console.log('바꿀 항목이 없어 아무것도 쓰지 않았습니다.');
  } else {
    console.log('복원했습니다. 감사 기록(restore/audit.log)에 한 줄을 덧붙였습니다.');
    const { decide } = await import('../src/decider.mjs');
    const { fixtureRequests } = await import('./fixture-7.mjs');
    const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
    const checks = await checkAfterRestore({ root, decide, fixtureRequests, config });
    for (const c of checks) console.log(`${c.passed ? '통과' : '확인 필요'} · ${c.name}`);
    console.log('B가 A의 자료를 요청하는 실제 거부는 배포 주소에 두 계정으로 보낸 요청이 아니면 확인할 수 없어 미실행입니다.');
    if (checks.some((c) => !c.passed)) process.exitCode = 1;
  }
} catch (error) {
  if (error instanceof RestoreAbort) {
    console.error(`중단: ${error.code} - ${error.message}`);
    process.exit(1);
  }
  throw error;
}
