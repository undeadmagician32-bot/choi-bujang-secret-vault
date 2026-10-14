import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { RestoreAbort, digestOf, planRestore, readCurrentPolicy } from '../src/restore-plan.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function writeSnapshot(policy, patch = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'restore-'));
  const path = join(dir, 'snap.json');
  const snap = { schema: 'aleph.policy.snapshot.v1', version: 3, capturedAt: '2026-10-13T00:00:00Z',
    policy, digest: digestOf(policy), ...patch };
  await writeFile(path, JSON.stringify(snap));
  return path;
}

test('현재 정책과 같은 사본은 차이 없음', async () => {
  const path = await writeSnapshot(await readCurrentPolicy(root));
  const plan = await planRestore({ root, snapshotPath: path });
  assert.equal(plan.version, 3);
  assert.deepEqual(plan.changes, []);
});

test('사라진 규칙·경로와 바뀐 값만 보여 줌', async () => {
  const saved = await readCurrentPolicy(root);
  const policy = { ...saved, ruleIds: [...saved.ruleIds, 'lost_rule'],
    allowedRoutes: saved.allowedRoutes.slice(1), originalApiUrl: 'https://example.invalid/rest/v1/memos' };
  const plan = await planRestore({ root, snapshotPath: await writeSnapshot(policy) });
  const keys = plan.changes.map((c) => `${c.restore}:${c.path}`).sort();
  assert.deepEqual(keys, ['add:ruleIds', 'remove:allowedRoutes', 'set:originalApiUrl']);
});

test('사본이 없으면 중단', async () => {
  await assert.rejects(planRestore({ root, snapshotPath: join(tmpdir(), 'no-such-snapshot.json') }),
    (e) => e instanceof RestoreAbort && e.code === 'SNAPSHOT_MISSING');
});

test('digest가 틀리거나 형식이 틀리면 중단', async () => {
  const policy = await readCurrentPolicy(root);
  await assert.rejects(planRestore({ root, snapshotPath: await writeSnapshot(policy, { digest: 'sha256:00' }) }),
    (e) => e.code === 'SNAPSHOT_DIGEST_MISMATCH');
  await assert.rejects(planRestore({ root, snapshotPath: await writeSnapshot(policy, { extra: 1 }) }),
    (e) => e.code === 'SNAPSHOT_INVALID');
  await assert.rejects(planRestore({ root, snapshotPath: await writeSnapshot({ ...policy, ruleIds: [] }) }),
    (e) => e.code === 'SNAPSHOT_INVALID');
});

test('계획은 aleph.config.json을 바꾸지 않음', async () => {
  const before = await readFile(join(root, 'aleph.config.json'), 'utf8');
  await planRestore({ root, snapshotPath: await writeSnapshot(await readCurrentPolicy(root)) });
  assert.equal(await readFile(join(root, 'aleph.config.json'), 'utf8'), before);
});
