// 알려진 취약점 악용(CVE-2021-44228 형태, MITRE ATT&CK T1190) 판정기입니다.
// 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 혼자 계산합니다.
// 아래 패턴은 xdr/known-cve/patterns.json 의 내용을 그대로 옮겨 적은 것입니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 'kc.jndi-lookup-in-header',
    name: '요청 머리글 안의 원격 조회 구문(jndi 형태)',
    mitre: 'T1190',
    condition: '요청 머리글 값(data.useragent)에 달러 기호와 중괄호로 감싼 jndi 조회 구문이 있고, 그 안에 원격 주소(ldap 등 조회 방식 + 주소)가 들어 있다. 단어 jndi 나 중괄호 하나만 있는 것은 해당하지 않는다.',
    basis: 'CVE-2021-44228(NVD): Log4j2 가 로그에 남기는 머리글 값 속 jndi 조회 구문을 해석해 원격 코드를 불러오며, MITRE ATT&CK T1190(외부 공개 앱 악용)의 초기 접근 형태다.',
  }),
  Object.freeze({
    id: 'kc.jndi-lookup-in-param',
    name: '요청 인자 안의 원격 조회 구문(jndi 형태)',
    mitre: 'T1190',
    condition: '요청 인자(data.url 의 쿼리 값)에 달러 기호와 중괄호로 감싼 jndi 조회 구문이 있고, 그 안에 원격 주소가 들어 있다. 같은 주소(data.srcip)에서 data.count 가 반복을 보이거나 머리글에도 같은 구문이 있으면 더 분명하다. CVE 번호나 jndi 라는 글자만 검색한 것은 해당하지 않는다.',
    basis: 'CVE-2021-44228(NVD): 로그에 남는 사용자 입력이면 위치와 상관없이 jndi 조회 구문이 해석되므로 요청 인자도 같은 악용 경로이며, MITRE ATT&CK T1190(외부 공개 앱 악용)의 초기 접근 형태다.',
  }),
  Object.freeze({
    id: 'kc.scanner-probe-with-lookup',
    name: '알려진 취약점 점검 도구 흔적과 함께 온 조회 구문',
    mitre: 'T1190',
    condition: '설명(rule.description)이 알려진 취약점 점검 흔적을 말하고, 같은 요청의 머리글이나 인자에 위 두 패턴의 원격 조회 구문이 함께 있다. 점검 도구와 비슷한 이름이나 수업용 프로그램 이름만 있고 조회 구문이 없으면 해당하지 않는다.',
    basis: 'CVE-2021-44228(NVD): 공개된 취약점이라 점검 도구가 조회 구문을 넣은 요청으로 악용 가능 여부를 시험하며, 이 시험 요청도 MITRE ATT&CK T1190(외부 공개 앱 악용) 시도에 해당한다.',
  }),
]);
const [HEADER, PARAM, SCANNER] = PATTERNS;

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
const HINT_MAX = 0.8; // 단서만으로는 block 하지 않습니다.

// 완전한 원격 조회 구문: 달러·중괄호 안에 jndi: 와 조회 방식://주소 가 모두 있어야 합니다.
const FULL_LOOKUP = /\$\{\s*jndi\s*:\s*(?:ldaps?|rmi|dns|iiop|corba|nds|nis|https?)\s*:\s*\/\/[^\s}]+\}/i;
// 흔한 감추기 표기(${lower:j}, ${upper:J}, ${::-j}, ${env:X:-j})는 안의 글자로 펼친 뒤 다시 봅니다.
const NESTED = /\$\{(?:lower|upper|::-|[a-z]+:[^:}]*:-)\s*:?([^${}]*)\}/gi;
// 설명이 원격 조회 구문이 '있다'고 말하는 표현입니다(데이터 항목이 비어 있을 때 보조로 씁니다).
const DESC_LOOKUP = /원격\s*조회\s*구문이\s*(?:있|들어|함께)|CVE-\d{4}-\d{4,}\s*(?:형태|표기)(?!.*글자만)|조회\s*구문이\s*머리글과\s*주소/;
const DENIAL = /(?:구문은|구문이)\s*없습니다|아닙니다|글자만\s*있습니다/;
const SCANNER_TRACE = /점검\s*(?:흔적|도구)|취약점\s*(?:점검|스캔)|scanner|nuclei|masscan|zgrab/i;

// 뚜렷하지 않은 단서입니다. 가까운 패턴을 함께 적습니다.
const HINTS = Object.freeze([
  { re: /\$\{|중괄호/, near: HEADER },
  { re: /jndi|조회\s*(?:형태|구문)|잘린/i, near: PARAM },
  { re: /점검\s*도구|취약점\s*(?:목록|이름)|cve-list/i, near: SCANNER },
  { re: /CVE-\d{4}-\d{4,}|log4j|라이브러리\s*이름/i, near: PARAM },
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

function decodeSafe(text) {
  let out = text;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch {
      break;
    }
  }
  return out;
}

function unwrapNested(text) {
  let out = text;
  for (let i = 0; i < 5; i += 1) {
    const next = out.replace(NESTED, '$1');
    if (next === out) break;
    out = next;
  }
  return out;
}

function hasFullLookup(text) {
  return FULL_LOOKUP.test(text) || FULL_LOOKUP.test(unwrapNested(text));
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
  const header = decodeSafe(asText(data.useragent));
  const param = decodeSafe(asText(data.url));
  const level = asNumber(rule.level);
  const count = asNumber(data.count) || asNumber((description.match(/(\d+)\s*(?:번|건)/) || [])[1]);

  // 1) 뚜렷한 형태: 요청 항목에 완전한 원격 조회 구문이 있으면 그 위치의 패턴에 맞습니다.
  //    항목이 비어 있으면 설명이 구문이 있다고 말하고 부정하지 않을 때만 같은 것으로 봅니다.
  const inHeader = hasFullLookup(header);
  const inParam = hasFullLookup(param);
  const descSays = !inHeader && !inParam && DESC_LOOKUP.test(description) && !DENIAL.test(description);
  if (inHeader || inParam || descSays) {
    const matched = [];
    if (inHeader || (descSays && /머리글/.test(description))) matched.push(HEADER);
    if (inParam || (descSays && !/머리글/.test(description))) matched.push(PARAM);
    if (descSays && /주소/.test(description) && !matched.includes(PARAM)) matched.push(PARAM);
    const scanner = SCANNER_TRACE.test(description) || SCANNER_TRACE.test(header);
    if (scanner) matched.push(SCANNER);
    let confidence = inHeader || inParam ? 0.88 : 0.86;
    if (inHeader && inParam) confidence += 0.04;
    if (scanner) confidence += 0.03;
    if (count >= 2) confidence += 0.03;
    confidence = round2(confidence + 0.05 * levelScore(level));
    const names = matched.map((p) => `「${p.name}」`).join(', ');
    return pick(confidence, `패턴 ${names}(CVE-2021-44228, T1190)에 뚜렷하게 맞음`);
  }

  // 2) 약한 단서: 규칙 수준이 4 이상일 때만 의심합니다. 단서만으로는 block 하지 않습니다.
  if (level >= 4) {
    const text = `${description} ${header} ${param}`;
    const hits = HINTS.filter((item) => item.re.test(text));
    if (hits.length > 0) {
      const confidence = round2(Math.min(HINT_MAX, 0.5 + 0.05 * (hits.length - 1) + 0.03 * Math.min(count, 3) + 0.1 * levelScore(level)));
      return pick(confidence, `패턴 「${hits[0].near.name}」과 비슷하지만 완전한 원격 조회 구문이 없어 애매함`);
    }
  }

  return pick(round2(0.2 * levelScore(level)), '알려진 취약점 악용 패턴에 맞지 않아 기록만 함');
}
