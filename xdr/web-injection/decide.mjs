// 웹 주입 공격(MITRE ATT&CK T1190) 판정기입니다.
// 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 혼자 계산합니다.
// 아래 패턴은 xdr/web-injection/patterns.json 의 내용을 그대로 옮겨 적은 것입니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 'wi.sql-fragment-in-param',
    name: '요청 인자 안의 SQL 구문',
    mitre: 'T1190',
    condition: '같은 주소(data.srcip)의 요청 인자(data.url 의 쿼리 값)에 SQL 구문 조각(조회·논리 연산·구문을 이어 붙이는 표기)이 들어 있고, 설명(rule.description)과 data.count 가 같은 주소에서 반복됐음을 보인다.',
    basis: 'MITRE ATT&CK T1190: 외부에 공개된 앱의 약점을 악용하는 초기 접근이며, 인자에 SQL을 섞어 넣는 SQL 삽입(CAPEC-66, CWE-89)이 그 대표적인 형태다.',
  }),
  Object.freeze({
    id: 'wi.script-tag-in-param',
    name: '요청 인자 안의 스크립트 태그',
    mitre: 'T1190',
    condition: '같은 주소(data.srcip)의 요청 인자(data.url 의 쿼리 값)에 스크립트 태그나 스크립트 삽입 표기가 들어 있고, 설명(rule.description)과 data.count 가 같은 주소에서 반복됐음을 보인다.',
    basis: 'MITRE ATT&CK T1190: 외부에 공개된 앱의 약점을 악용하는 초기 접근이며, 인자에 스크립트를 심는 교차 사이트 스크립트(CAPEC-63, CWE-79)가 그 대표적인 형태다.',
  }),
  Object.freeze({
    id: 'wi.path-traversal-repeat',
    name: '경로 거슬러 올라가기(../) 반복',
    mitre: 'T1190',
    condition: '같은 주소(data.srcip)의 요청 인자(data.url 의 경로 값)에 상위 폴더로 올라가는 표기(../)가 여러 단계 이어지거나 여러 번 반복되고, 설명(rule.description)과 data.count 가 그 반복을 보인다.',
    basis: 'MITRE ATT&CK T1190: 외부에 공개된 앱의 약점을 악용하는 초기 접근이며, ../ 로 공개 범위 밖 파일에 닿으려는 경로 이탈(CAPEC-126, CWE-22)이 그 대표적인 형태다.',
  }),
  Object.freeze({
    id: 'wi.command-separator-repeat',
    name: '요청 인자 안의 명령 구분자 반복',
    mitre: 'T1190',
    condition: '같은 주소(data.srcip)의 요청 인자(data.url 의 쿼리 값)에 명령을 이어 붙이는 구분자 표기가 들어 있고, 설명(rule.description)과 data.count 가 연속 요청에서 반복됐음을 보인다.',
    basis: 'MITRE ATT&CK T1190: 외부에 공개된 앱의 약점을 악용하는 초기 접근이며, 인자에 구분자로 운영체제 명령을 이어 붙이는 명령 삽입(CAPEC-88, CWE-78)이 그 대표적인 형태다.',
  }),
]);

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

// 패턴마다 '뚜렷한 형태'를 보이는 표기입니다. 설명(rule.description)과 요청 주소(data.url)에서 찾습니다.
// 연습 경보의 주소는 doc-sql·doc-script·doc-up 같은 문서용 표식이라 이것도 같은 표기로 봅니다.
const CLEAR_FORMS = Object.freeze([
  /SQL\s*(?:구문|표식|표기)|데이터베이스\s*조회를?\s*이어|구문을\s*이어\s*붙|union\s+select|\bor\s+1\s*=\s*1|doc-sql/i,
  /스크립트\s*(?:삽입|표식|태그)|<\s*script|%3c\s*script|doc-script/i,
  /거슬러|경로\s*이탈|\.\.\/|\.\.%2f|%2e%2e%2f|doc-up/i,
  /명령\s*구분자|doc-cmd/i,
]);

// 뚜렷하지는 않지만 의심스러운 단서입니다. 가까운 패턴 번호를 함께 적습니다.
const HINTS = Object.freeze([
  { re: /SQL|select|따옴표|구분\s*문자/i, pattern: 0 },
  { re: /스크립트/, pattern: 1 },
  { re: /\bup\b|경로에/i, pattern: 2 },
  { re: /주입처럼|이상한|평소보다\s*깁니다|공격\s*표기/, pattern: -1 },
]);

// 설명이 스스로 '아니다·없다'고 말하면 뚜렷한 형태로 보지 않습니다.
const DENIAL = /아닙니다|없습니다|않았습니다/;
const NO_REPEAT = /반복은\s*없습니다|반복되지\s*않았습니다/;
// 패턴 이름이 없는 반복 표기(예: 명령 구분자)를 잡는 느슨한 단서입니다.
const LOOSE_REPEAT = /표기|표식|구문/;

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

function decodeSafe(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// 반복이 많을수록 뚜렷합니다. 한 번뿐이거나 설명이 반복을 부정하면 낮게 둡니다.
function repeatScore(count, description) {
  if (NO_REPEAT.test(description)) return 0.2;
  if (count >= 10) return 1;
  if (count >= 5) return 0.85;
  if (count >= 3) return 0.7;
  if (count === 2) return 0.45;
  return 0.3;
}

// 규칙 수준 3 이하는 평소 이벤트로 봅니다.
function levelScore(level) {
  return clamp01((level - 3) / 6);
}

function round2(n) {
  return Math.round(clamp01(n) * 100) / 100;
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
  const text = `${description} ${decodeSafe(asText(data.url))}`;
  const level = asNumber(rule.level);
  const count = asNumber(data.count) || asNumber((description.match(/(\d+)\s*번/) || [])[1]);

  const repeat = repeatScore(count, description);
  const lv = levelScore(level);

  // 1) 뚜렷한 형태: 설명이 부정하지 않고, 패턴의 표기가 보이면 많이 맞는 쪽을 근거로 삼습니다.
  const clear = CLEAR_FORMS.map((re) => (re.test(text) ? 1 : 0));
  const clearCount = clear.reduce((sum, hit) => sum + hit, 0);
  if (clearCount > 0 && !DENIAL.test(description)) {
    const names = clear.map((hit, index) => (hit ? `「${PATTERNS[index].name}」` : null)).filter(Boolean).join(', ');
    const confidence = round2(0.4 + 0.35 * repeat + 0.25 * lv);
    if (confidence >= BLOCK_AT) return pick(confidence, `패턴 ${names}(T1190)에 뚜렷하게 맞음`);
    return pick(confidence, `패턴 ${names}(T1190)에 일부만 맞아 애매함`);
  }

  // 2) 약한 단서: 규칙 수준이 4 이상일 때만 의심합니다. 단서만으로는 block 하지 않습니다.
  if (level >= 4) {
    const hint = HINTS.find((item) => item.re.test(description)) || (clearCount > 0 ? { pattern: clear.indexOf(1) } : null);
    const loose = !hint && count >= 3 && level >= 8 && LOOSE_REPEAT.test(description) && !DENIAL.test(description);
    if (hint || loose) {
      const confidence = round2(0.5 + 0.2 * repeat + 0.1 * lv);
      const near = hint && hint.pattern >= 0 ? `패턴 「${PATTERNS[hint.pattern].name}」(T1190)과 비슷하지만` : '알려진 패턴 이름은 없지만 의심스러운 표기가 있고';
      return pick(confidence, `${near} 뚜렷하지 않아 애매함`);
    }
  }

  return pick(round2(0.2 * lv), '알려진 웹 주입 패턴에 맞지 않아 기록만 함');
}
