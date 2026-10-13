// 자료 빼돌리기(명령 통로·다른 프로토콜로 유출, MITRE ATT&CK T1041·T1048) 판정기입니다.
// 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 혼자 계산합니다.
// 아래 패턴은 xdr/exfiltration/patterns.json 의 내용을 그대로 옮겨 적은 것입니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 'ex.first-seen-bulk-transfer',
    name: '처음 보는 목적지로 대용량 전송',
    mitre: 'T1048',
    condition: '설명이 자료가 처음 보는 목적지나 외부 주소(data.dstip)로 나갔다고 말하고, 전송량(data.bytes)이 크거나 파일 수(data.files)가 많다. 짧은 시간에 몰렸거나, 자료실·메모 묶음 전체처럼 보이거나, 평소에 쓰지 않던 포트·프로토콜로 나갔으면 더 분명하다. 처음 보는 주소로 작은 파일 몇 건, 평소 목적지로 파일 수가 한 번 는 경우는 단서일 뿐 이 패턴의 확실한 형태가 아니다.',
    basis: 'MITRE ATT&CK T1048(다른 프로토콜로 유출): 공격자는 평소 명령 통로와 다른 프로토콜·포트로 처음 보는 목적지에 자료를 한꺼번에 내보낸다.',
  }),
  Object.freeze({
    id: 'ex.off-hours-archive-out',
    name: '업무 시간 밖 압축 파일 반출',
    mitre: 'T1048',
    condition: '설명이 수업·업무 시간 밖에 압축 파일이 외부나 처음 보는 주소로 나갔다고 말한다. 같은 압축 파일이 여러 목적지로 나갔거나, 압축 파일이 연속으로 올라갔거나, 같은 목적지로 여러 번(data.count) 나갔으면 더 분명하다. 수업 시간 안에 압축 파일을 만들기만 하고 내보내지 않은 경우, 수업 끝 무렵 백업처럼 보이는 1건은 해당하지 않는다.',
    basis: 'MITRE ATT&CK T1048(다른 프로토콜로 유출): 유출할 자료는 흔히 압축 파일로 묶여 주인이 쓰지 않는 시각에 다른 프로토콜로 외부 목적지에 보내진다.',
  }),
  Object.freeze({
    id: 'ex.c2-channel-repeat',
    name: '명령 통로로 반복 전송',
    mitre: 'T1041',
    condition: '설명이 명령 통로로 자료가 나갔거나 같은 목적지로 대용량 전송이 여러 번(data.count) 반복됐다고 말하고, 전송량(data.bytes)이 크다. 목적지가 처음 보는 곳이면 더 분명하다. 명령 통로에 짧은 자료 이름만 몇 번 보이고 큰 파일이 없는 경우, 전송량이 한 번만 평소보다 높은 경우는 단서일 뿐 이 패턴의 확실한 형태가 아니다.',
    basis: 'MITRE ATT&CK T1041(명령 통로로 유출): 공격자는 이미 열어 둔 명령·제어 통로에 자료를 실어 같은 목적지로 나누어 반복해 내보낸다.',
  }),
]);
const [BULK, OFF_HOURS_ARCHIVE, C2_REPEAT] = PATTERNS;

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
const HINT_MAX = 0.8; // 단서만으로는 block 하지 않습니다.

// 크기·개수 기준은 MITRE 에 없는 연습용 값이고 xdr/fixtures/exfiltration.json 에 맞춰 정했습니다.
const LARGE_BYTES = 50_000_000;
const MANY_FILES = 50;
const MANY_REPEATS = 5;

// 처음 보는 목적지·외부 주소로 나갔습니다.
const NEW_DESTINATION = /처음\s*보는\s*(?:목적지|주소)|외부\s*주소/;
// 평소와 다른 포트·프로토콜입니다(T1048 의 다른 프로토콜).
const ODD_PORT = /평소에\s*쓰지\s*않던\s*(?:포트|프로토콜)/;
// 받침 신호: 짧은 시간에 몰렸거나, 묶음·전체이거나, 연속·여러 목적지입니다.
const BURST = /\d+\s*분\s*안|짧은\s*시간|한\s*번에|연속/;
const WHOLE = /전체|묶음/;
const MANY_PLACES = /두\s*곳|여러\s*(?:곳|목적지)/;
// 압축 파일이 밖으로 나갔습니다. 만들기만 한 경우는 아닙니다.
const ARCHIVE_OUT = /압축\s*파일[^.]*(?:나갔|올라갔|보냈)/;
const OFF_HOURS = /수업\s*시간\s*밖|업무\s*시간\s*밖/;
// 명령 통로이거나 같은 목적지로 되풀이됐습니다.
const C2_TEXT = /명령\s*통로|같은\s*목적지/;
const REPEAT_TEXT = /반복|(\d+)\s*번/;
const FAILED = /실패/;

// 뚜렷하지 않은 단서입니다. 가까운 패턴을 함께 적습니다.
const HINTS = Object.freeze([
  { re: /처음\s*보는|처음\s*봅니다|평소와\s*다른|다른\s*주소/, near: BULK },
  { re: /압축/, near: OFF_HOURS_ARCHIVE },
  { re: /명령\s*통로|전송량/, near: C2_REPEAT },
  { re: /전송|나갔|파일\s*수/, near: BULK },
]);

function asText(value) {
  return typeof value === 'string' ? value : '';
}

function asNumber(value) {
  const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
  return Number.isFinite(n) ? n : 0;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function round2(n) {
  return Math.round(clamp01(n) * 100) / 100;
}

// 규칙 수준 3 이하는 평소 이벤트로 봅니다.
function levelScore(level) {
  return clamp01((level - 3) / 10);
}

function pick(confidence, reason) {
  if (confidence >= BLOCK_AT) return { action: 'block', confidence, reason };
  if (confidence >= ALERT_AT) return { action: 'alert', confidence, reason };
  return { action: 'record', confidence, reason };
}

export function decide(alert) {
  const source = alert !== null && typeof alert === 'object' ? alert : {};
  const data = source.data !== null && typeof source.data === 'object' ? source.data : {};
  const rule = source.rule !== null && typeof source.rule === 'object' ? source.rule : {};
  const description = asText(rule.description);
  const level = asNumber(rule.level);
  const bytes = asNumber(data.bytes);
  const files = asNumber(data.files);
  const repeats = asNumber(data.count) || asNumber((description.match(REPEAT_TEXT) || [])[1]);

  const large = bytes >= LARGE_BYTES;
  const failed = FAILED.test(description);
  const newDestination = NEW_DESTINATION.test(description);
  const offHours = OFF_HOURS.test(description);

  // 1) 뚜렷한 형태: 패턴의 중심 조건에 받침 신호가 하나 이상 붙어야 합니다.
  const matched = [];
  let support = 0;
  if (!failed && large && (newDestination || ODD_PORT.test(description))) {
    const s = [BURST.test(description), WHOLE.test(description), MANY_PLACES.test(description),
      ODD_PORT.test(description), files >= MANY_FILES].filter(Boolean).length;
    if (s > 0) {
      matched.push(BULK);
      support = Math.max(support, s);
    }
  }
  if (!failed && offHours && ARCHIVE_OUT.test(description)) {
    const s = 1 + [newDestination, MANY_PLACES.test(description), repeats >= 2, large].filter(Boolean).length;
    matched.push(OFF_HOURS_ARCHIVE);
    support = Math.max(support, s);
  }
  if (!failed && large && C2_TEXT.test(description)) {
    const s = [repeats >= MANY_REPEATS, newDestination, offHours].filter(Boolean).length;
    if (s > 0) {
      matched.push(C2_REPEAT);
      support = Math.max(support, s);
    }
  }
  if (matched.length > 0) {
    const confidence = round2(0.86 + 0.03 * (support - 1) + 0.05 * levelScore(level));
    const names = matched.map((p) => `「${p.name}」`).join(', ');
    const ids = [...new Set(matched.map((p) => p.mitre))].join('·');
    return pick(confidence, `패턴 ${names}(${ids})에 뚜렷하게 맞음`);
  }

  // 2) 약한 단서: 규칙 수준이 4 이상일 때만 의심합니다. 단서만으로는 block 하지 않습니다.
  if (level >= 4) {
    const hits = HINTS.filter((item) => item.re.test(description));
    if (hits.length > 0) {
      const confidence = round2(Math.min(HINT_MAX, 0.5 + 0.05 * (hits.length - 1) + 0.1 * levelScore(level)));
      return pick(confidence, `패턴 「${hits[0].near.name}」과 비슷하지만 받침 신호가 없어 애매함`);
    }
  }

  return pick(round2(0.2 * levelScore(level)), '자료 빼돌리기 패턴에 맞지 않아 기록만 함');
}
