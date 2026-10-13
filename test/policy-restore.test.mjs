import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { mock } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { POLICY_FILES, SNAPSHOT_SCHEMA, sha256, snapshotVersion } from '../scripts/policy-diff.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const script = join(repo, 'scripts', 'policy-restore.mjs');
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMO_A = '11111111-1111-4111-8111-111111111111';

// 시험 정책 폴더: 실제 정책 파일 여섯 개의 복사본 + 정책 밖 파일 두 개(보존 확인용).
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'policy-restore-'));
  for (const path of POLICY_FILES) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), readFileSync(join(repo, path)));
  }
  mkdirSync(join(root, 'xdr'), { recursive: true });
  writeFileSync(join(root, 'xdr', 'other-service-rules.json'), '{"service":"other","rule":"keep"}\n');
  mkdirSync(join(root, 'backup'), { recursive: true });
  writeFileSync(join(root, 'backup', 'policy-restore-audit.log'), '{"old":"audit line"}\n');
  return root;
}

function makeSnapshot(root) {
  const files = Object.fromEntries(POLICY_FILES.map((path) => {
    const content = readFileSync(join(root, path), 'utf8');
    return [path, { sha256: sha256(content), content }];
  }));
  const snap = { schema: SNAPSHOT_SCHEMA, version: snapshotVersion(files), createdAt: '2026-10-13T00:00:00.000Z', files };
  writeFileSync(join(root, 'backup', 'policy-snapshot.json'), JSON.stringify(snap));
  return snap;
}

const run = (root, ...args) => spawnSync(process.execPath, [script, '--root', root, ...args], { encoding: 'utf8' });
const read = (root, path) => readFileSync(join(root, path), 'utf8');

function fakeDb(rows) {
  return {
    from() {
      const filters = []; let op = 'select'; let patch;
      const match = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      const q = {
        select() { return q; },
        eq(c, v) { filters.push([c, v]); return q; },
        update(p) { op = 'update'; patch = p; return q; },
        delete() { op = 'delete'; return q; },
        maybeSingle: () => Promise.resolve({ data: match()[0] ?? null, error: null }),
        then(resolve) {
          const m = match();
          if (op === 'update') m.forEach((r) => Object.assign(r, patch));
          if (op === 'delete') m.forEach((r) => rows.splice(rows.indexOf(r), 1));
          return Promise.resolve({ data: m.map((r) => ({ id: r.id })), error: null }).then(resolve);
        },
      };
      return q;
    },
  };
}
const fakeResponse = () => ({
  headers: {}, code: null, body: null,
  setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; },
});

test('--confirm 없이는 미리보기만 하고 아무것도 바꾸지 않습니다', () => {
  const root = makeRoot();
  const snap = makeSnapshot(root);
  writeFileSync(join(root, 'src/decider.mjs'), '// 침해됨\n');
  const result = run(root);
  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`복원할 버전: ${snap.version}`));
  assert.match(result.stdout, /되돌릴 파일 1개: src\/decider\.mjs/);
  assert.match(result.stdout, /--confirm /);
  assert.equal(read(root, 'src/decider.mjs'), '// 침해됨\n');
  assert.equal(read(root, 'backup/policy-restore-audit.log'), '{"old":"audit line"}\n');
});

test('잘못된 버전 확인·검증 실패 사본은 중단하고 아무것도 바꾸지 않습니다', () => {
  const root = makeRoot();
  const snap = makeSnapshot(root);
  writeFileSync(join(root, 'src/decider.mjs'), '// 침해됨\n');
  const wrong = run(root, '--confirm', 'abcdef0');
  assert.equal(wrong.status, 2);
  assert.match(wrong.stdout, /다릅니다\. 아무것도 바꾸지 않았습니다/);
  assert.equal(read(root, 'src/decider.mjs'), '// 침해됨\n');

  const broken = JSON.parse(readFileSync(join(root, 'backup/policy-snapshot.json'), 'utf8'));
  broken.files['src/decider.mjs'].content += 'evil\n';
  writeFileSync(join(root, 'backup/policy-snapshot.json'), JSON.stringify(broken));
  const bad = run(root, '--confirm', snap.version);
  assert.equal(bad.status, 2);
  assert.match(bad.stdout, /^중단: 안전 정책 사본 검증 실패/);
  assert.equal(read(root, 'src/decider.mjs'), '// 침해됨\n');
  assert.equal(run(makeRoot()).status, 2);
});

test('확인하면 바뀐 정책만 되돌리고, 다른 서비스 규칙과 기존 감사 기록은 보존합니다', () => {
  const root = makeRoot();
  const snap = makeSnapshot(root);
  const untouchedBefore = { decide: read(root, 'src/detect.mjs'), other: read(root, 'xdr/other-service-rules.json') };
  writeFileSync(join(root, 'src/decider.mjs'), '// 침해됨\n');
  writeFileSync(join(root, 'src/resources.mjs'), '// 침해됨\n');
  const result = run(root, '--confirm', snap.version);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /되돌림 완료: 버전 \w{7}, 파일 2개/);
  for (const path of POLICY_FILES) assert.equal(read(root, path), snap.files[path].content, path);
  assert.equal(read(root, 'src/detect.mjs'), untouchedBefore.decide);
  assert.equal(read(root, 'xdr/other-service-rules.json'), untouchedBefore.other);
  const audit = read(root, 'backup/policy-restore-audit.log').trim().split('\n');
  assert.equal(audit.length, 2);
  assert.equal(audit[0], '{"old":"audit line"}');
  const entry = JSON.parse(audit[1]);
  assert.equal(entry.outcome, 'restored');
  assert.deepEqual(entry.files.map((f) => f.path).sort(), ['src/decider.mjs', 'src/resources.mjs']);
  assert.equal(JSON.stringify(entry).includes('침해됨'), false);
  const saved = join(root, entry.preRestoreDir);
  assert.equal(readFileSync(join(saved, 'src/decider.mjs'), 'utf8'), '// 침해됨\n');
  assert.deepEqual(readdirSync(join(saved, 'src')).sort(), ['decider.mjs', 'resources.mjs']);
  // 같은 버전을 다시 확인하면 바꿀 것이 없고 감사 기록도 늘지 않습니다.
  const again = run(root, '--confirm', snap.version);
  assert.match(again.stdout, /되돌릴 것이 없어/);
  assert.equal(read(root, 'backup/policy-restore-audit.log').trim().split('\n').length, 2);
});

test('되돌린 뒤: 판정기는 미등록 기기를 다시 거부하고, B의 A 메모 요청은 거부·A 정상 요청은 유지됩니다', async () => {
  const root = makeRoot();
  const snap = makeSnapshot(root);
  // 침해: 판정기를 모두 허용으로 바꿈
  writeFileSync(join(root, 'src/decider.mjs'), 'export const RULE_IDS = [\'x\'];\nexport async function decide(r) { return { schema: \'aleph.decision.v1\', requestId: r.requestId, decision: \'allow\', reasonCode: \'approved\', ruleIds: [\'x\'] }; }\n');
  assert.equal(run(root, '--confirm', snap.version).status, 0);

  const { decide } = await import(`${pathToFileURL(join(root, 'src/decider.mjs')).href}?restored`);
  const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
  const { normal } = fixtureRequests();
  assert.equal((await decide(normal)).decision, 'allow');
  const unregistered = await decide({ ...normal, requestId: crypto.randomUUID(), deviceRegistered: false });
  assert.equal(unregistered.decision, 'deny');
  assert.equal(unregistered.reasonCode, 'device_not_registered');

  // 메모 API(정책 파일이 아니라 되돌리기가 건드리지 않는 코드)는 그대로 소유자만 통과시킵니다.
  const real = await import('../src/memo-api.mjs');
  const rows = [{ id: MEMO_A, owner_id: A, title: 'A 메모', body: '가상 본문' }];
  const session = { userId: null };
  mock.module(new URL('../src/memo-api.mjs', import.meta.url).href, {
    namedExports: { ...real, authorize: async () => ({ userId: session.userId, supabase: fakeDb(rows) }) },
  });
  const { default: handler } = await import('../api/memos/[id].js');
  const call = async (user, method, body) => {
    session.userId = user;
    const response = fakeResponse();
    await handler({ method, query: { id: MEMO_A }, body, headers: {} }, response);
    return response;
  };
  const origWarn = console.warn; console.warn = () => {};
  try {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const denied = await call(B, method, { title: '탈취', body: 'x' });
      assert.equal(denied.code, 404, `B ${method}`);
    }
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'A 메모');
    const ok = await call(A, 'GET');
    assert.equal(ok.code, 200);
    assert.equal(ok.body.title, 'A 메모');
    assert.equal(ok.headers['X-Resource-Id'], 'vault.memo');
  } finally { console.warn = origWarn; }
});
