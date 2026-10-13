// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 규칙에 맞지 않는 요청은 기본 응답으로 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required']);

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

export async function decide(request) {
  // 6단계 device_registered: 엔진이 등록됐다고 확인한 기기(true)만 통과. 미등록·값 없음은 거부.
  if (request.deviceRegistered !== true) {
    return response(request, 'deny', 'device_not_registered', 'device_registered');
  }
  // 7단계 step_up_required: 평소와 다른 시각 + 처음 보는 네트워크 + 짧은 시간 많은 읽기가 함께일 때만 추가 확인.
  // 지역 하나만으로는 판단하지 않고, 거부(차단)가 아니라 step_up을 돌려 사유 코드와 규칙 이름을 남깁니다.
  if (request.method === 'GET' && isUnusualBurst(readAccessContext(request))) {
    if (recentlyReverified(request.stepUp)) {
      return response(request, 'allow', 'approved', 'step_up_required');
    }
    return response(request, 'step_up', 'step_up_required', 'step_up_required');
  }
  // 등록 기기의 내 자료실 읽기(GET)만 허용.
  if (request.method === 'GET') {
    return response(request, 'allow', 'approved', 'device_registered');
  }
  return response(request, 'deny', 'starter_not_ready', RULE_IDS[0]);
}
