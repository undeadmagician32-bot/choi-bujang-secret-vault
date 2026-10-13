// 몰래 심어진 프로그램(지속성 유지, MITRE ATT&CK T1543·T1053·T1547.001) 판정기입니다.
// 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 혼자 계산합니다.
// 아래 패턴은 xdr/persistence/patterns.json 의 내용을 그대로 옮겨 적은 것입니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 'ps.unsigned-new-service',
    name: '서명 없는 새 서비스 등록·서비스 실행 파일 변경',
    mitre: 'T1543.003',
    condition: '설명(rule.description)이 평소 목록에 없는 서비스의 새 등록이나 서비스 실행 파일의 변경을 말하고, 그 실행 파일에 서명이 없다. 실행 파일(data.path)이 사용자 임시 폴더(AppData\\Local\\Temp)에 있거나, 같은 주소(data.srcip)에서 등록이 반복(data.count)되면 더 분명하다. 서비스 설명만 바뀌었거나, 같은 파일로 다시 시작됐거나, 서명된 기존 서비스는 해당하지 않는다.',
    basis: 'MITRE ATT&CK T1543.003(Windows 서비스): 공격자는 새 서비스를 만들거나 기존 서비스의 실행 파일을 바꿔 다시 켤 때마다 자기 프로그램이 실행되도록 남긴다.',
  }),
  Object.freeze({
    id: 'ps.unfamiliar-scheduled-task',
    name: '낯선 예약 작업',
    mitre: 'T1053.005',
    condition: '설명이 처음 보는 예약 작업의 생성을 말하고, 작업 이름이 임의 문자열이거나 수업 시간 밖에 실행되거나 실행 파일(data.path)이 사용자 임시 폴더에 있다. 수업 시간에 수업 폴더의 스크립트를 실행하는 작업, 운영체제 업데이트처럼 평소 시각 그대로인 기존 작업은 해당하지 않는다.',
    basis: 'MITRE ATT&CK T1053.005(예약 작업): 공격자는 Windows 작업 스케줄러에 작업을 등록해 정해진 시각이나 시작 때마다 자기 프로그램을 다시 실행시킨다.',
  }),
  Object.freeze({
    id: 'ps.startup-folder-change',
    name: '시작 폴더에 낯선 프로그램 추가',
    mitre: 'T1547.001',
    condition: '설명이 시작 폴더나 시작 프로그램 목록에 평소 목록에 없는 프로그램이 추가됐다고 말하고, 실행 파일(data.path)이 사용자 시작 폴더(Start Menu\\Programs\\Startup)나 임시 폴더에 있다. 같은 임시 파일을 예약 작업도 함께 가리키면 더 분명하다. 목록을 읽기만 했거나, 수업 도구 이름의 항목이거나, 이어서 실행된 기록 없는 변경 1건은 해당하지 않는다.',
    basis: 'MITRE ATT&CK T1547.001(실행 키·시작 폴더): 사용자 시작 폴더에 넣은 프로그램은 로그인할 때마다 자동으로 실행되어 다시 켜도 남는다.',
  }),
]);
const [SERVICE, TASK, STARTUP] = PATTERNS;

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
const HINT_MAX = 0.8; // 단서만으로는 block 하지 않습니다.

// 서비스 패턴: 평소 목록에 없는 서비스의 새 등록이나 실행 파일 변경. '설명만 바뀜', '다시 시작', '등록은 없음'은 아닙니다.
const SERVICE_CHANGE = /(?:새|평소\s*목록에\s*없는)\s*서비스|서비스\s*등록(?!\s*(?:은|이)?\s*없)|서비스\s*실행\s*파일이\s*바뀌/;
const UNSIGNED = /서명\s*(?:이|은)?\s*없/;
// 예약 작업 패턴: 낯선 작업이라는 표현과 이상한 실행 조건입니다.
const TASK_UNFAMILIAR = /(?:처음\s*보는|낯선|평소\s*목록에\s*없는)\s*예약\s*작업|예약\s*작업\s*이름이\s*임의/;
const TASK_ODD = /수업\s*시간\s*밖|임의\s*문자열/;
// 시작 폴더 패턴: 시작 폴더·프로그램 목록에 낯선 프로그램이 추가됐거나 임시 파일을 가리킵니다.
const STARTUP_ADD = /시작\s*(?:폴더|프로그램|항목)[^.]*?(?:평소\s*목록에\s*없는|가리킵|추가)/;
const TASK_WORD = /예약\s*작업/;
const TEMP_PATH = /\\AppData\\Local\\Temp\\/i;
const STARTUP_PATH = /\\Start Menu\\Programs\\Startup\\/i;
const TEMP_WORD = /임시\s*(?:폴더|파일)/;

// 뚜렷하지 않은 단서입니다. 가까운 패턴을 함께 적습니다.
const HINTS = Object.freeze([
  { re: /서비스/, near: SERVICE },
  { re: /예약\s*작업/, near: TASK },
  { re: /시작\s*(?:폴더|프로그램|항목)/, near: STARTUP },
  { re: /임시\s*폴더|실행\s*파일/, near: SERVICE },
  { re: /서명은\s*(?:확인되지|아직)/, near: SERVICE },
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
  const path = asText(data.path);
  const level = asNumber(rule.level);
  const count = asNumber(data.count) || asNumber((description.match(/(\d+)\s*건/) || [])[1]);

  const inTemp = TEMP_PATH.test(path) || TEMP_WORD.test(description);
  const unsigned = UNSIGNED.test(description);
  const repeated = count >= 2;

  // 1) 뚜렷한 형태: 패턴의 중심 조건에 받침 신호(서명 없음·임시 폴더·반복·이상한 실행 조건)가 하나 이상 붙어야 합니다.
  const matched = [];
  let support = 0;
  if (SERVICE_CHANGE.test(description)) {
    const s = [unsigned, inTemp, repeated].filter(Boolean).length;
    if (s > 0) {
      matched.push(SERVICE);
      support = Math.max(support, s);
    }
  }
  if (TASK_UNFAMILIAR.test(description)) {
    const s = [inTemp, TASK_ODD.test(description)].filter(Boolean).length;
    if (s > 0) {
      matched.push(TASK);
      support = Math.max(support, s);
    }
  }
  if (STARTUP_ADD.test(description) && (STARTUP_PATH.test(path) || inTemp)) {
    matched.push(STARTUP);
    support = Math.max(support, 1);
    // 같은 임시 파일을 예약 작업도 가리키면 두 패턴이 겹칩니다.
    if (TASK_WORD.test(description) && !matched.includes(TASK)) {
      matched.push(TASK);
      support += 1;
    }
  }
  if (matched.length > 0) {
    const confidence = round2(0.86 + 0.03 * (support - 1) + 0.05 * levelScore(level));
    const names = matched.map((p) => `「${p.name}」`).join(', ');
    const ids = matched.map((p) => p.mitre).join('·');
    return pick(confidence, `패턴 ${names}(${ids})에 뚜렷하게 맞음`);
  }

  // 2) 약한 단서: 규칙 수준이 4 이상일 때만 의심합니다. 단서만으로는 block 하지 않습니다.
  if (level >= 4) {
    const text = `${description} ${path}`;
    const hits = HINTS.filter((item) => item.re.test(text));
    if (hits.length > 0) {
      const confidence = round2(Math.min(HINT_MAX, 0.5 + 0.05 * (hits.length - 1) + 0.1 * levelScore(level)));
      return pick(confidence, `패턴 「${hits[0].near.name}」과 비슷하지만 받침 신호가 없어 애매함`);
    }
  }

  return pick(round2(0.2 * levelScore(level)), '몰래 심어진 프로그램 패턴에 맞지 않아 기록만 함');
}
