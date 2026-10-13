// 권한 가로채기(권한 상승·정상 계정 도용, MITRE ATT&CK T1068·T1078) 판정기입니다.
// 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 혼자 계산합니다.
// 아래 패턴은 xdr/privilege/patterns.json 의 내용을 그대로 옮겨 적은 것입니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 'pv.admin-group-add',
    name: '평범한 계정의 관리자 그룹 추가',
    mitre: 'T1078',
    condition: '설명이 평범한 계정(data.srcuser)이 관리자 그룹에 추가됐다고 말하고, 그룹(data.group)이 administrators 다. 원격 주소나 처음 보는 주소에서 추가됐거나, 같은 주소에서 여러 계정이 추가(data.count)됐거나, 빠졌다가 곧바로 다시 들어왔거나, 추가 직후 관리자 명령이 이어지면 더 분명하다. 관리자 그룹이 아닌 과제·수업 그룹 추가, 새 그룹을 만들었지만 관리자 권한이 없는 경우는 해당하지 않는다.',
    basis: 'MITRE ATT&CK T1078(정상 계정 도용): 공격자는 손에 넣은 정상 계정을 관리자 그룹에 넣어, 새 계정을 만들지 않고도 높은 권한을 쓰고 계속 유지한다.',
  }),
  Object.freeze({
    id: 'pv.first-seen-admin-command',
    name: '처음 보는 관리자 명령 실행',
    mitre: 'T1068',
    condition: '설명이 평소 관리자가 아닌 계정이 관리자 명령을 실행했다고 말하고, 그 계정이 방금 관리자가 됐거나, 세션이 관리자 권한으로 바뀌었거나, 다른 계정의 권한으로 실행했거나, 처음 보는 주소(data.srcip)에서 왔다. 평소 주소에서 관리자 명령 1건, 실패로 끝난 관리자 명령, 이어진 명령 없는 권한 상승 1건은 단서일 뿐 이 패턴의 확실한 형태가 아니다.',
    basis: 'MITRE ATT&CK T1068(권한 상승 악용): 공격자는 취약점을 악용해 평범한 계정에서 관리자 권한을 얻고, 그 결과는 그 계정이 평소 쓰지 않던 관리자 명령을 실행하는 모습으로 드러난다.',
  }),
  Object.freeze({
    id: 'pv.off-hours-privilege-use',
    name: '업무 시간 밖 권한 사용',
    mitre: 'T1078',
    condition: '설명이 수업 시간 밖이나 업무처럼 보이지 않는 시각에 관리자 그룹 추가나 관리자 명령 실행이 있었다고 말한다. 처음 보는 주소이거나 그룹 추가와 명령 실행이 함께 있으면 더 분명하다. 수업 시간 안의 평소 로그인·로그아웃·조회는 해당하지 않는다.',
    basis: 'MITRE ATT&CK T1078(정상 계정 도용): 도용된 정상 계정은 주인이 쓰지 않는 시각이나 처음 보는 곳에서 권한을 쓰는 모습으로 정상 사용과 구별된다.',
  }),
]);
const [GROUP_ADD, ADMIN_COMMAND, OFF_HOURS] = PATTERNS;

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
const HINT_MAX = 0.8; // 단서만으로는 block 하지 않습니다.

const ADMIN_GROUP = 'administrators';
// 관리자 그룹 패턴: 관리자 그룹에 추가됐거나 다시 관리자로 들어왔습니다. '관리자 그룹은 아닙니다'는 아닙니다.
const GROUP_ADD_TEXT = /관리자\s*그룹(?:에\s*(?:추가|들어)|\s*추가)|다시\s*관리자로\s*들어/;
const READDED = /빠진[^.]*다시\s*관리자로/;
// 관리자 명령 패턴: 관리자 명령·권한 명령을 실행했거나 세션이 관리자 권한으로 바뀌었습니다. 실패로 끝난 명령은 아닙니다.
const ADMIN_COMMAND_TEXT = /(?:관리자|권한)\s*명령(?:을|과)?\s*실행(?!\s*(?:은|이)?\s*없)|권한\s*명령|관리자\s*권한으로\s*바뀌/;
const COMMAND_FAILED = /실패/;
const JUST_PROMOTED = /방금\s*관리자가\s*된|곧바로|직후/;
const OTHER_ACCOUNT = /다른\s*계정의\s*권한/;
// 받침 신호: 처음 보는 곳에서 왔습니다.
const NEW_PLACE = /처음\s*보는\s*주소|처음\s*봅니다|원격\s*주소/;
// 업무 시간 밖 패턴: 연습 경보의 시각은 모두 수업 시간이라 설명의 표현으로 봅니다.
const OFF_HOURS_TEXT = /수업\s*시간\s*밖|업무\s*시간\s*밖|업무처럼\s*보이지\s*않는\s*시각/;
const COMMAND_WORD = /명령\s*실행|명령을\s*실행/;

// 뚜렷하지 않은 단서입니다. 가까운 패턴을 함께 적습니다.
const HINTS = Object.freeze([
  { re: /관리자\s*명령/, near: ADMIN_COMMAND },
  { re: /권한\s*상승/, near: ADMIN_COMMAND },
  { re: /관리자\s*그룹/, near: GROUP_ADD },
  { re: /그룹/, near: GROUP_ADD },
  { re: /계정\s*종류/, near: GROUP_ADD },
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
  const group = asText(data.group).toLowerCase();
  const level = asNumber(rule.level);
  const count = asNumber(data.count) || asNumber((description.match(/계정\s*(\d+)\s*개/) || [])[1]);

  const newPlace = NEW_PLACE.test(description);
  const groupAdd = (group === ADMIN_GROUP || group === '') && GROUP_ADD_TEXT.test(description);
  const adminCommand = ADMIN_COMMAND_TEXT.test(description) && !COMMAND_FAILED.test(description);
  const offHours = OFF_HOURS_TEXT.test(description);

  // 1) 뚜렷한 형태: 패턴의 중심 조건에 받침 신호가 하나 이상 붙어야 합니다.
  const matched = [];
  let support = 0;
  if (groupAdd) {
    const followedByCommand = COMMAND_WORD.test(description) || /권한\s*명령/.test(description);
    const s = [newPlace, count >= 2, READDED.test(description), followedByCommand, /평범한\s*계정/.test(description)]
      .filter(Boolean).length;
    if (s > 0) {
      matched.push(GROUP_ADD);
      support = Math.max(support, s);
    }
  }
  if (adminCommand) {
    const s = [JUST_PROMOTED.test(description), OTHER_ACCOUNT.test(description), newPlace].filter(Boolean).length;
    if (s > 0) {
      matched.push(ADMIN_COMMAND);
      support = Math.max(support, s);
    }
  }
  if (offHours && (groupAdd || adminCommand || COMMAND_WORD.test(description))) {
    matched.push(OFF_HOURS);
    const s = 1 + [newPlace, groupAdd && COMMAND_WORD.test(description)].filter(Boolean).length;
    support = Math.max(support, s);
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

  return pick(round2(0.2 * levelScore(level)), '권한 가로채기 패턴에 맞지 않아 기록만 함');
}
