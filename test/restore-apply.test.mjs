import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { RestoreAbort, digestOf, planRestore, readCurrentPolicy } from '../src/restore-plan.mjs';
import { applyRestore, checkAfterRestore } from '../src/restore-apply.mjs';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

const realRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

// 실제 저장소를 건드리지 않도록 설정·코드만 임시 폴더로 복사합니다.
async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'restore-apply-'));
  await cp(join(realRoot, 'src'), join(root, 'src'), { recursive: true });
  await cp(join(realRoot, 'api'), join(root, 'api'), { recursive: true });
  await cp(join(realRoot, 'aleph.config.json'), join(root, 'aleph.config.json'));
  return root;
}

async function snapshotFrom(root, mutate) {
  const policy = await readCurrentPolicy(root);
  mutate?.(policy);
  const path = join(root, 'snap.json');
  await writeFile(path, JSON.stringify({ schema: 'aleph.policy.snapshot.v1', version: 7,
    capturedAt: '2026-10-13T00:00:00Z', policy, digest: digestOf(policy) }));
  return path;
}

// 침해 상황: 허용 경로에 남의 자료를 여는 경로가 끼고, 원본 API 주소가 바뀌었다. 별도 설정 항목(step 등)은 그대로여야 한다.
async function compromise(root) {
  const file = join(root, 'aleph.config.json');
  const config = JSON.parse(await readFile(file, 'utf8'));
  config.allowedRoutes = [...config.allowedRoutes, 'GET /api/memos'.replace('memos', 'all-memos')];
  config.originalApiUrl = 'https://example.invalid/rest/v1/memos';
  config.step = 10;
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

test('확인 번호 없이는 아무것도 바꾸지 않음', async () => {
  const root = await tempRoot();
  const snap = await snapshotFrom(root);
  await compromise(root);
  const before = await readFile(join(root, 'aleph.config.json'), 'utf8');
  await assert.rejects(applyRestore({ root, snapshotPath: snap }), (e) => e.code === 'PLAN_NOT_CONFIRMED');
  await assert.rejects(applyRestore({ root, snapshotPath: snap, confirmPlanId: 'plan:0000000000000000' }),
    (e) => e.code === 'PLAN_NOT_CONFIRMED');
  assert.equal(await readFile(join(root, 'aleph.config.json'), 'utf8'), before);
});

test('복원하면 정책만 사본으로 돌아가고 다른 설정과 감사 기록은 보존', async () => {
  const root = await tempRoot();
  const snap = await snapshotFrom(root);
  const hurt = await compromise(root);
  await writeFile(join(root, 'restore-audit-seed'), '');
  const plan = await planRestore({ root, snapshotPath: snap });
  assert.deepEqual(plan.changes.map((c) => `${c.restore}:${c.path}`).sort(), ['remove:allowedRoutes', 'set:originalApiUrl']);
  const result = await applyRestore({ root, snapshotPath: snap, confirmPlanId: plan.planId,
    now: () => new Date('2026-10-14T00:00:00Z') });
  assert.equal(result.applied, true);
  const config = JSON.parse(await readFile(join(root, 'aleph.config.json'), 'utf8'));
  assert.equal(config.step, 10);
  assert.equal(config.judgeIssuer, hurt.judgeIssuer);
  assert.deepEqual((await planRestore({ root, snapshotPath: snap })).changes, []);
  // 두 번째 복원도 감사 기록을 지우지 않고 덧붙임
  await compromise(root);
  const plan2 = await planRestore({ root, snapshotPath: snap });
  await applyRestore({ root, snapshotPath: snap, confirmPlanId: plan2.planId,
    now: () => new Date('2026-10-14T01:00:00Z') });
  const lines = (await readFile(join(root, 'restore/audit.log'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].at, '2026-10-14T00:00:00.000Z');
  assert.equal(lines[1].version, 7);
  assert.ok(!JSON.stringify(lines).includes('example.invalid'));
});

test('규칙 이름이 사본과 다르면 자동 복원하지 않고 중단', async () => {
  const root = await tempRoot();
  const snap = await snapshotFrom(root, (p) => { p.ruleIds = [...p.ruleIds, 'lost_rule']; });
  await compromise(root);
  const before = await readFile(join(root, 'aleph.config.json'), 'utf8');
  const plan = await planRestore({ root, snapshotPath: snap });
  await assert.rejects(applyRestore({ root, snapshotPath: snap, confirmPlanId: plan.planId }),
    (e) => e instanceof RestoreAbort && e.code === 'CODE_POLICY_DIFFERS');
  assert.equal(await readFile(join(root, 'aleph.config.json'), 'utf8'), before);
});

test('계획을 본 뒤 상태가 바뀌면 같은 확인 번호로 실행되지 않음', async () => {
  const root = await tempRoot();
  const snap = await snapshotFrom(root);
  await compromise(root);
  const plan = await planRestore({ root, snapshotPath: snap });
  const file = join(root, 'aleph.config.json');
  const config = JSON.parse(await readFile(file, 'utf8'));
  config.allowedRoutes.push('DELETE /api/everything');
  await writeFile(file, JSON.stringify(config, null, 2));
  await assert.rejects(applyRestore({ root, snapshotPath: snap, confirmPlanId: plan.planId }),
    (e) => e.code === 'PLAN_NOT_CONFIRMED');
});

test('복원 뒤 점검: A 정상 요청 유지, 소유자 조건 유지', async () => {
  const root = await tempRoot();
  const snap = await snapshotFrom(root);
  await compromise(root);
  const plan = await planRestore({ root, snapshotPath: snap });
  await applyRestore({ root, snapshotPath: snap, confirmPlanId: plan.planId });
  const config = JSON.parse(await readFile(join(root, 'aleph.config.json'), 'utf8'));
  const checks = await checkAfterRestore({ root, decide, fixtureRequests, config });
  assert.deepEqual(checks.filter((c) => !c.passed), []);
  assert.ok(checks.length >= 5);
});
