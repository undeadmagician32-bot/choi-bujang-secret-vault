import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
import { RULE_IDS, decide } from '../src/decider.mjs';

// docs/DECIDER_REQUEST.md의 요청 이름 18개와 응답 이름 5개. 가상 요청만 쓰며 실제 심판 판정이 아닙니다.
const CONTRACT = ['schema', 'requestId', 'classId', 'projectId', 'subjectId', 'deviceId', 'service', 'method', 'path',
  'route', 'queryLength', 'querySha256', 'at', 'policyRevision', 'deviceRegistered', 'stepUp', 'recentEvents', 'signals'];
const RESPONSE_KEYS = 'decision,reasonCode,requestId,ruleIds,schema';
const { normal, suspicious } = fixtureRequests();
const fresh = (base, patch = {}) => ({ ...base, requestId: randomUUID(), ...patch });
const events = (n, count = 1) => Array.from({ length: n }, () => ({ kind: 'risk_signal', ageSeconds: 10, count }));

const cases = {
  '정상 읽기': normal,
  '복합 이상 읽기': suspicious,
  '복합 이상 + 최근 재인증': fresh(suspicious, { stepUp: { verified: true, authAgeSeconds: 60 } }),
  '재인증이 너무 오래됨': fresh(suspicious, { stepUp: { verified: true, authAgeSeconds: 901 } }),
  '재인증 값이 문자열': fresh(suspicious, { stepUp: { verified: 'true', authAgeSeconds: 1 } }),
  '재인증 값이 null': fresh(suspicious, { stepUp: null }),
  '미등록 기기': fresh(normal, { deviceRegistered: false }),
  '등록 값 없음': fresh(normal, { deviceRegistered: undefined }),
  '등록 값이 문자열': fresh(normal, { deviceRegistered: 'true' }),
  '등록 값이 숫자 1': fresh(normal, { deviceRegistered: 1 }),
  '사용자 없음': fresh(normal, { subjectId: '' }),
  '사용자가 숫자': fresh(normal, { subjectId: 7 }),
  '기기 ID 형식 오류': fresh(normal, { deviceId: 'ABC' }),
  '기기 ID 없음': fresh(normal, { deviceId: undefined }),
  '메모 수정': fresh(normal, { method: 'PUT', route: 'PUT /notes/:id' }),
  '공지 수정': fresh(normal, { service: 'notices', method: 'PUT', route: 'PUT /notices/:id', path: '/notices/n1' }),
  '메모 삭제(표에 없음)': fresh(normal, { method: 'DELETE', route: 'DELETE /notes/:id' }),
  '쿼리가 붙음': fresh(normal, { queryLength: 5 }),
  '기능 경로 export': fresh(normal, { route: 'GET /notes/:id/export', path: '/notes/demo/export' }),
  '경로 칸 수가 다름': fresh(normal, { path: '/notes/a/b' }),
  '경로가 객체': fresh(normal, { path: { x: 1 } }),
  'route가 constructor': fresh(normal, { route: 'constructor' }),
  'route가 __proto__': fresh(normal, { route: '__proto__' }),
  'route가 null': fresh(normal, { route: null }),
  'service가 다름': fresh(normal, { service: 'notices' }),
  'signals 없음': fresh(suspicious, { signals: undefined }),
  'signals에 항목이 더 있음': fresh(suspicious, { signals: { ...suspicious.signals, geo: 'KR' } }),
  'signals 출처 none': fresh(normal, { signals: { source: 'none', region: 'unknown', network: 'unknown', hour: 0 } }),
  'signals 시각 범위 밖': fresh(suspicious, { signals: { ...suspicious.signals, hour: 99 } }),
  'signals 출처 불명': fresh(suspicious, { signals: { ...suspicious.signals, source: 'client_header' } }),
  '사건 13건': fresh(suspicious, { recentEvents: events(13) }),
  '사건 형식 오류': fresh(suspicious, { recentEvents: [{ kind: 'x' }] }),
  '사건이 null': fresh(suspicious, { recentEvents: null }),
  '사건이 많아 보이는 읽기': fresh(suspicious, { recentEvents: events(12, 5) }),
};

function assertValidResponse(request, response, label) {
  assert.ok(response && typeof response === 'object' && !Array.isArray(response), label);
  assert.equal(Object.keys(response).sort().join(','), RESPONSE_KEYS, `${label}: 응답 이름은 5개뿐`);
  assert.equal(response.schema, 'aleph.decision.v1', label);
  assert.equal(response.requestId, request.requestId, `${label}: 요청 ID를 그대로 돌려줌`);
  assert.ok(['allow', 'deny', 'step_up'].includes(response.decision), label);
  assert.match(response.reasonCode, /^[a-z][a-z0-9_]{0,63}$/u, label);
  assert.ok(Array.isArray(response.ruleIds) && response.ruleIds.length >= 1, `${label}: 규칙 이름이 하나 이상`);
  for (const id of response.ruleIds) assert.ok(RULE_IDS.includes(id), `${label}: ${id}는 RULE_IDS에 있어야 함`);
}

test('가상 요청 모두에 형식이 맞는 응답을 돌려주고 ruleIds는 모두 RULE_IDS 안에 있습니다', async () => {
  assert.ok(Object.keys(cases).length >= 30);
  for (const [label, request] of Object.entries(cases)) {
    assertValidResponse(request, await decide(request), label);
  }
});

test('요청에서는 계약의 18개 이름만 읽습니다(role·identity·device·geo는 읽지 않음)', async () => {
  const seen = new Set();
  const spy = (request) => new Proxy(request, {
    get(target, key) { seen.add(String(key)); return target[key]; },
    has(target, key) { seen.add(String(key)); return key in target; },
    ownKeys(target) { seen.add('<ownKeys>'); return Reflect.ownKeys(target); },
  });
  for (const request of Object.values(cases)) await decide(spy(request));
  const unknown = [...seen].filter((name) => !CONTRACT.includes(name));
  assert.deepEqual(unknown, [], `계약에 없는 이름을 읽었습니다: ${unknown.join(', ')}`);
  for (const forbidden of ['role', 'identity', 'device', 'geo']) assert.equal(seen.has(forbidden), false, forbidden);
  assert.ok(seen.has('deviceRegistered') && seen.has('route') && seen.has('signals'), '핵심 항목은 실제로 읽음');
});

test('계약에 없는 role·identity·device·geo를 덧붙여도 판정이 바뀌지 않습니다', async () => {
  const extras = { role: 'instructor', identity: { sub: 'x' }, device: { approval: 'approved' }, geo: { country: 'KR' } };
  for (const [label, request] of Object.entries(cases)) {
    const plain = await decide(request);
    const withExtras = await decide({ ...request, ...extras });
    assert.deepEqual(withExtras, plain, `${label}: 덧붙인 항목이 판정에 영향`);
  }
  const notice = await decide({ ...cases['공지 수정'], ...extras });
  assert.equal(notice.decision, 'deny');
  assert.equal(notice.reasonCode, 'instructor_not_verified');
});
