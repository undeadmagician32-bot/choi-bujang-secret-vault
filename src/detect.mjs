// 9단계에서 학생이 채우는 탐지 함수입니다. 이 기본값은 어떤 접속도 회수하지 않습니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.

// 입력 정리: 계약(docs/DETECT_EVENTS.md)의 사건은 {at, method, identity: {sub}} 세 값뿐입니다.
// 가명 사용자(identity.sub)·요청 종류(method)·시각(at)만 새 객체로 옮기고, 다른 항목(메모 본문, 토큰, 이름 등)은
// 복사하지도 출력하지도 않습니다. 모양이 계약과 다른 사건은 고쳐 쓰지 않고 버립니다.
// 기기와 판정 결과는 이 계약에 없어 읽지 않습니다.
const EVENT_KEYS = 'at,identity,method';
const METHODS = Object.freeze(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
// 가명은 영문·숫자·_·-만 받습니다. 공백·@·점이 든 값(실명, 이메일, 토큰 모양)은 가명으로 보지 않습니다.
const PSEUDONYM = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function readEvent(event) {
  if (!isPlainObject(event) || Object.keys(event).sort().join(',') !== EVENT_KEYS) return null;
  const { identity } = event;
  if (!isPlainObject(identity) || Object.keys(identity).join(',') !== 'sub') return null;
  if (typeof identity.sub !== 'string' || !PSEUDONYM.test(identity.sub)) return null;
  if (!METHODS.includes(event.method)) return null;
  if (typeof event.at !== 'string' || !ISO_UTC.test(event.at)) return null;
  const at = Date.parse(event.at);
  if (!Number.isFinite(at)) return null;
  return { subject: identity.sub, method: event.method, at };
}

// 정리된 사건 배열과 버린 사건 수만 돌려줍니다. 버린 사건의 내용은 남기지 않습니다.
export function readDetectionEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const read = [];
  let dropped = 0;
  for (const event of events) {
    const clean = readEvent(event);
    if (clean) read.push(clean);
    else dropped += 1;
  }
  read.sort((a, b) => a.at - b.at);
  return { events: read, dropped };
}

// 다량 조회 규칙(계약 기준): 같은 가명 사용자의 GET이 어느 10분 구간에서든 120건을 넘을 때만 회수를 제안합니다.
// 정확히 120건은 대상이 아니고, 다른 사용자의 사건은 합치지 않습니다. 네트워크·지역은 이 계약에 없어 보지 않습니다.
const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_MAX_READS = 120;

function findBurstSubject(events) {
  const readsBySubject = new Map();
  for (const event of events) {
    if (event.method !== 'GET') continue;
    if (!readsBySubject.has(event.subject)) readsBySubject.set(event.subject, []);
    readsBySubject.get(event.subject).push(event.at);
  }
  let found = null;
  for (const [subject, times] of readsBySubject) {
    let start = 0;
    for (let end = 0; end < times.length; end += 1) {
      while (times[end] - times[start] >= BURST_WINDOW_MS) start += 1;
      if (end - start + 1 > BURST_MAX_READS) {
        if (!found || times[end] < found.at) found = { subject, at: times[end] };
        break;
      }
    }
  }
  return found ? found.subject : null;
}

export function detect(events) {
  const { events: read } = readDetectionEvents(events);
  const subject = findBurstSubject(read);
  if (subject) return { action: 'propose_revocation', reasonCode: 'burst_read', subject };
  return { action: 'observe' };
}

// 회수 제안(별도 결과): detect() 응답과 판정기의 allow/deny 응답은 그대로 두고, 따로 제안 한 건만 만듭니다.
// 탐지 사건에는 기기 항목이 없으므로, 기기는 엔진이 확인한 {subjectId, deviceId} 한 쌍(docs/DECIDER_REQUEST.md 형식)으로만 받습니다.
// 탐지된 가명 사용자와 subjectId가 같을 때만 그 기기 한 개를 대상으로 적습니다. 회수 실행·기기 권한 변경·시각 기록은 하지 않습니다.
const DEVICE_ID = /^[0-9a-f]{16}$/;

export function proposeRevocation(detection, verified) {
  if (!isPlainObject(detection) || detection.action !== 'propose_revocation') return null;
  if (detection.reasonCode !== 'burst_read' || typeof detection.subject !== 'string') return null;
  if (!isPlainObject(verified) || Object.keys(verified).sort().join(',') !== 'deviceId,subjectId') return null;
  if (verified.subjectId !== detection.subject || !DEVICE_ID.test(verified.deviceId)) return null;
  return {
    action: 'propose_revocation',
    reasonCode: detection.reasonCode,
    target: { subjectId: verified.subjectId, deviceId: verified.deviceId },
  };
}
