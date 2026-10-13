// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 규칙에 맞지 않는 요청은 기본 응답으로 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required',
  'route_zone', 'memo_zone', 'notice_write_zone']);

const response = (request, decision, reasonCode, ruleId) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision,
  reasonCode,
  ruleIds: [ruleId],
});

// 7단계 입력 검사: 계약(docs/DECIDER_REQUEST.md)의 signals·recentEvents만 접속 정보로 읽고 출처를 구분합니다.
// 계약 밖 항목(헤더, geo, ip 등)은 읽지 않습니다. 값이 없거나 형식이 틀리면 null로 두고 정상값으로 채우지 않습니다.
const SIGNAL_KEYS = 'hour,network,region,source';
const EVENT_KEYS = 'ageSeconds,count,kind';
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const knownText = value => (typeof value === 'string' && value && value !== 'unknown' ? value : null);
const wholeNumber = (value, min, max) => (Number.isInteger(value) && value >= min && value <= max ? value : null);

function readRecentEvents(events) {
  if (!Array.isArray(events) || events.length > 12) return null;
  const read = events.map(event => (isPlainObject(event) && Object.keys(event).sort().join(',') === EVENT_KEYS
    && typeof event.kind === 'string' && event.kind
    && wholeNumber(event.ageSeconds, 0, Number.MAX_SAFE_INTEGER) !== null
    && wholeNumber(event.count, 0, Number.MAX_SAFE_INTEGER) !== null
    ? { kind: event.kind, ageSeconds: event.ageSeconds, count: event.count } : null));
  return read.includes(null) ? null : read;
}

// origin: 'engine_none'(엔진이 접속 정보 없음을 알림), 'judge_fixture'(심판 가상 요청, 실제 위치 증거 아님),
// 'unverified'(signals가 없거나 형식·출처가 계약과 다름). 'unverified'의 값은 모두 버립니다.
export function readAccessContext(request) {
  const signals = isPlainObject(request?.signals) ? request.signals : null;
  const shapeOk = signals && Object.keys(signals).sort().join(',') === SIGNAL_KEYS;
  const origin = !shapeOk ? 'unverified'
    : signals.source === 'none' ? 'engine_none'
      : signals.source === 'judge_fixture' ? 'judge_fixture' : 'unverified';
  const usable = origin === 'judge_fixture';
  return {
    origin,
    region: usable ? knownText(signals.region) : null,
    network: usable ? knownText(signals.network) : null,
    hour: usable ? wholeNumber(signals.hour, 0, 23) : null,
    recentEvents: readRecentEvents(request?.recentEvents),
  };
}

// 연습용 기준값(심판·운영 기준 아님): 0~5시를 평소와 다른 시각, 최근 5분 사건 10건 이상을 갑작스런 많은 읽기로 봅니다.
const UNUSUAL_HOURS = Object.freeze([0, 1, 2, 3, 4, 5]);
const BURST_WINDOW_SECONDS = 300;
const BURST_MIN_COUNT = 10;
const REVERIFY_MAX_AGE_SECONDS = 300;

function isUnusualBurst(context) {
  if (context.origin !== 'judge_fixture' || !context.recentEvents) return false;
  const recentCount = context.recentEvents
    .filter(event => event.ageSeconds <= BURST_WINDOW_SECONDS)
    .reduce((sum, event) => sum + event.count, 0);
  return UNUSUAL_HOURS.includes(context.hour)
    && context.network === 'unusual'
    && recentCount >= BURST_MIN_COUNT;
}

// 엔진이 확인한 재인증이 최근(5분 이내)일 때만 추가 확인을 통과한 것으로 봅니다.
const recentlyReverified = stepUp => isPlainObject(stepUp) && stepUp.verified === true
  && wholeNumber(stepUp.authAgeSeconds, 0, REVERIFY_MAX_AGE_SECONDS) !== null;

// 8단계 구역: 엔진이 확인한 "메서드 + 경로 모양"(route)마다 자원 ID와 서비스를 정합니다.
// 자원 ID는 src/resources.mjs와 같은 값입니다. 경로의 마지막 칸은 자료 ID 하나뿐이고,
// 같은 깊이에 export 같은 기능 경로를 두지 않습니다. 쿼리로 기능을 고르지 않습니다.
const ZONES = Object.freeze({
  'GET /notes/:id': { service: 'notes', resourceId: 'vault.memo' }, // 자기 메모 읽기
  'PUT /notes/:id': { service: 'notes', resourceId: 'vault.memo' }, // 자기 메모 수정
  'PUT /notices/:id': { service: 'notices', resourceId: 'class.notice' }, // 강사 공지 수정
});
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const DEVICE_ID = /^[0-9a-f]{16}$/u;

// 표에 있는 route이고, 메서드·서비스가 같고, path가 그 모양에 정확히 맞고, 쿼리가 없을 때만 구역을 돌려줍니다.
function readZone(request) {
  const zone = Object.hasOwn(ZONES, request.route) ? ZONES[request.route] : null;
  if (!zone || request.service !== zone.service || request.queryLength !== 0) return null;
  const [method, template] = request.route.split(' ');
  if (request.method !== method || typeof request.path !== 'string') return null;
  const want = template.split('/');
  const got = request.path.split('/');
  if (got.length !== want.length) return null;
  const pathOk = want.every((part, i) => (part === ':id' ? RESOURCE_ID.test(got[i]) : got[i] === part));
  return pathOk ? zone : null;
}

export async function decide(request) {
  // 6단계 device_registered: 엔진이 등록됐다고 확인한 기기(true)만 통과. 미등록·값 없음은 거부.
  if (request.deviceRegistered !== true) {
    return response(request, 'deny', 'device_not_registered', 'device_registered');
  }
  // 8단계 route_zone: 엔진이 확인한 사용자(subjectId)와 기기(deviceId)가 있어야 하고,
  // 구역 표에 정확히 맞지 않는 메서드·경로·쿼리는 모두 거부합니다.
  if (typeof request.subjectId !== 'string' || !request.subjectId || !DEVICE_ID.test(request.deviceId ?? '')) {
    return response(request, 'deny', 'subject_not_verified', 'route_zone');
  }
  const zone = readZone(request);
  if (!zone) return response(request, 'deny', 'route_not_allowed', 'route_zone');
  // 8단계 notice_write_zone: 강사 공지 수정은 강사만 가능해야 하지만, 계약에 엔진이 확인한 역할이 없습니다.
  // 브라우저가 보낸 역할은 믿지 않으므로 지금은 누구의 공지 수정도 허용하지 않습니다.
  if (zone.resourceId === 'class.notice') {
    return response(request, 'deny', 'instructor_not_verified', 'notice_write_zone');
  }
  // 7단계 step_up_required: 평소와 다른 시각 + 처음 보는 네트워크 + 짧은 시간 많은 읽기가 함께일 때만 추가 확인.
  // 지역 하나만으로는 판단하지 않고, 거부(차단)가 아니라 step_up을 돌려 사유 코드와 규칙 이름을 남깁니다.
  if (request.method === 'GET' && isUnusualBurst(readAccessContext(request))) {
    if (recentlyReverified(request.stepUp)) {
      return response(request, 'allow', 'approved', 'step_up_required');
    }
    return response(request, 'step_up', 'step_up_required', 'step_up_required');
  }
  // 8단계 memo_zone: 등록 기기의 메모 읽기·수정. 메모 주인이 본인인지는 계약에 소유자 항목이 없어
  // 여기서 알 수 없고, 서버 함수가 DB 쿼리(owner_id = 확인된 사용자)로 다시 거릅니다(4단계).
  if (zone.resourceId === 'vault.memo') {
    return response(request, 'allow', 'approved', 'memo_zone');
  }
  return response(request, 'deny', 'starter_not_ready', RULE_IDS[0]);
}
