import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { RULE_IDS } from '../src/decider.mjs';
import { buildOpsSummary, opsLogRecord } from '../src/ops-summary.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SECRET_BODY = '가상 메모 본문 시험 문장';
const HASH = 'ab'.repeat(32);

// 가상 값만 쓰는 메모리 저장소. 실제 표처럼 owner_id로 걸러서 돌려주고, 일부러 본문·식별자가 든 열도 섞어 둡니다.
const fakeStore = (overrides = {}) => {
  const devices = [{ owner_id: A, status: 'approved', id: 'dev-a1' }, { owner_id: A, status: 'pending', id: 'dev-a2' },
    { owner_id: B, status: 'revoked', id: 'dev-b1' }];
  const backups = [
    { owner_id: B, memo_id: 'memo-b', title: SECRET_BODY, body: SECRET_BODY, backed_up_at: '2026-10-01T00:00:00Z', content_hash: HASH },
    { owner_id: A, memo_id: 'memo-a', title: SECRET_BODY, body: SECRET_BODY, backed_up_at: '2026-09-30T00:00:00Z', content_hash: 'cd'.repeat(32) },
  ];
  const audit = [{ owner_id: B, outcome: 'restored' }, { owner_id: B, outcome: 'denied_not_found' }, { owner_id: A, outcome: 'restored' }];
  return {
    deviceRows: async (user) => devices.filter((r) => r.owner_id === user),
    backups: async (user) => { const rows = backups.filter((r) => r.owner_id === user); return { rows, count: rows.length }; },
    auditRows: async (user) => { const rows = audit.filter((r) => r.owner_id === user); return { rows, count: rows.length }; },
    ...overrides,
  };
};
const fixed = { now: () => new Date('2026-10-14T00:00:00Z'), recordId: () => 'abcd1234' };

test('screen numbers and the masked server record come from the same summary and match', async () => {
  const summary = await buildOpsSummary({ userId: B, store: fakeStore(), ...fixed });
  const log = opsLogRecord(summary);
  assert.equal(log.id, summary.recordId);
  assert.equal(log.rules, summary.rules.count);
  assert.equal(summary.rules.count, RULE_IDS.length);
  assert.deepEqual(summary.rules.ruleIds, [...RULE_IDS]);
  assert.deepEqual(log.devices, [0, 0, 1]); // B: 회수됨 1
  assert.equal(summary.revocation.devices.revoked, 1);
  assert.equal(log.versions, summary.restore.versions.count);
  assert.equal(log.versions, 1);
  assert.equal(log.audit, 2);
  assert.equal(log.restored, 1);
  assert.equal(summary.restore.audit.byOutcome.denied_not_found, 1);
  assert.deepEqual(summary.restore.versions.latest, [{ backedUpAt: '2026-10-01T00:00:00Z', hash8: 'abababab' }]);
});

test('only the signed-in user\'s own rows are counted', async () => {
  const a = await buildOpsSummary({ userId: A, store: fakeStore(), ...fixed });
  assert.deepEqual(a.revocation.devices, { pending: 1, approved: 1, revoked: 0, other: 0, total: 2 });
  assert.equal(a.restore.versions.count, 1);
  assert.equal(a.restore.versions.latest[0].hash8, 'cdcdcdcd');
  assert.equal(a.restore.audit.total, 1);
});

test('nothing that was not run is reported as confirmed', async () => {
  const s = await buildOpsSummary({ userId: A, store: fakeStore(), ...fixed });
  assert.equal(s.detection.status, 'not_run');
  assert.equal(s.detection.events, null);
  assert.equal(s.detection.proposals, null);
  assert.equal(s.rules.liveDecisions.status, 'not_run');
  assert.equal(s.revocation.enforcement.status, 'not_run');
  assert.equal(s.restore.policySnapshot.status, 'not_run');
  assert.equal(opsLogRecord(s).detection, 'not_run');
});

test('summary and record never contain memo text, ids, or the user id', async () => {
  const text = JSON.stringify(await buildOpsSummary({ userId: A, store: fakeStore(), ...fixed }));
  const log = JSON.stringify(opsLogRecord(await buildOpsSummary({ userId: A, store: fakeStore(), ...fixed })));
  for (const forbidden of [SECRET_BODY, A, B, 'memo-a', 'memo-b', 'dev-a1', 'body', 'title', 'owner_id', 'cdcdcdcd'.repeat(2)]) {
    assert.equal(text.includes(forbidden), false, `summary leaked ${forbidden}`);
    assert.equal(log.includes(forbidden), false, `log leaked ${forbidden}`);
  }
});

test('a failed read is reported as failed with no numbers, and other sections stay', async () => {
  const boom = async () => { throw new Error(`db down ${SECRET_BODY}`); };
  const s = await buildOpsSummary({ userId: A, store: fakeStore({ deviceRows: boom, auditRows: boom }), ...fixed });
  assert.equal(s.revocation.status, 'failed');
  assert.equal(s.revocation.devices, null);
  assert.equal(s.restore.status, 'failed');
  assert.equal(s.restore.audit, null);
  assert.equal(s.restore.versions.count, 1);
  assert.equal(s.rules.status, 'verified');
  const log = opsLogRecord(s);
  assert.equal(log.devices, null);
  assert.equal(log.audit, null);
  assert.equal(JSON.stringify(s).includes(SECRET_BODY), false); // 오류 문구도 싣지 않음
});

test('unexpected outcome or device values are counted as other, not shown', async () => {
  const store = fakeStore({
    deviceRows: async () => [{ status: 'approved' }, { status: '<script>' }],
    auditRows: async () => ({ rows: [{ outcome: 'restored' }, { outcome: 'Bad Value!' }], count: 2 }),
  });
  const s = await buildOpsSummary({ userId: A, store, ...fixed });
  assert.equal(s.revocation.devices.other, 1);
  assert.equal(s.restore.audit.other, 1);
  assert.equal(JSON.stringify(s).includes('script'), false);
  assert.equal(JSON.stringify(s).includes('Bad Value'), false);
});

test('the page draws only server values with textContent and never reads memo fields for the ops view', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const ops = html.slice(html.indexOf('// 탈환 작전실(12단계)'), html.indexOf('// 기기 승인(11단계)'));
  assert.ok(ops.length > 500);
  assert.equal(/innerHTML|insertAdjacentHTML|localStorage|sessionStorage/u.test(ops), false);
  assert.equal(/\.(body|title|content)\b/u.test(ops), false);
  assert.match(ops, /\/api\/ops\/summary/u);
});

test('the response carries the masked server record, identical to what the server logs', async () => {
  const summary = await buildOpsSummary({ userId: B, store: fakeStore(), ...fixed });
  assert.deepEqual(summary.serverRecord, opsLogRecord({ ...summary, serverRecord: undefined }));
  assert.equal(summary.serverRecord.id, summary.recordId);
  assert.equal(summary.serverRecord.rules, summary.rules.count);
  assert.deepEqual(summary.serverRecord.devices, [summary.revocation.devices.pending, summary.revocation.devices.approved, summary.revocation.devices.revoked]);
  assert.equal(summary.serverRecord.versions, summary.restore.versions.count);
  assert.equal(summary.serverRecord.audit, summary.restore.audit.total);
  const text = JSON.stringify(summary.serverRecord);
  for (const forbidden of [SECRET_BODY, A, B, 'memo-b', 'dev-b1']) assert.equal(text.includes(forbidden), false);
});

test('the page shows the masked record and compares it with the numbers on screen', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const ops = html.slice(html.indexOf('// 탈환 작전실(12단계)'), html.indexOf('// 기기 승인(11단계)'));
  assert.match(ops, /data\.serverRecord/u);
  assert.match(ops, /화면과 일치/u);
  assert.match(ops, /응답에 없음/u);
});
