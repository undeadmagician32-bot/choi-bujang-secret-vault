// 무차별 로그인 공격(MITRE ATT&CK T1110) 판정기입니다.
// 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 혼자 계산합니다.
// 아래 패턴은 xdr/brute-force/patterns.json 의 내용을 그대로 옮겨 적은 것입니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 'bf.same-source-fail-burst',
    name: '같은 주소의 짧은 시간 로그인 실패 연속',
    mitre: 'T1110.001',
    condition: '경보 data.srcip 가 같은 주소에서 설명(rule.description)에 적힌 짧은 시간 안에 data.count 가 큰 로그인 실패가 이어졌고 성공이 섞이지 않았다.',
    basis: 'MITRE ATT&CK T1110.001 비밀번호 추측: 공격자가 한 계정이나 한 주소에서 비밀번호를 반복해 넣어 맞는 값을 찾는다.',
  }),
  Object.freeze({
    id: 'bf.multi-account-same-password',
    name: '여러 계정에 같은 비밀번호 대입',
    mitre: 'T1110.003',
    condition: '같은 주소(data.srcip)가 서로 다른 여러 계정(data.accounts 또는 설명에 적힌 계정 수)에 같은 비밀번호로 로그인 실패를 연속으로 넣었다.',
    basis: 'MITRE ATT&CK T1110.003 비밀번호 스프레이: 공격자가 흔한 비밀번호 하나를 여러 계정에 차례로 넣어 계정 잠금을 피한다.',
  }),
]);

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
const PATTERN_WEIGHT = 0.7;
const LEVEL_WEIGHT = 0.3;

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

// 패턴 1: 실패 건수가 클수록 뚜렷합니다. 설명에 '실패'가 없으면 맞지 않습니다.
function burstStrength(count, description) {
  if (!description.includes('실패') || count <= 0) return 0;
  if (count >= 40) return 1;
  if (count >= 20) return 0.95;
  if (count >= 10) return 0.85;
  if (count >= 5) return 0.7;
  if (count >= 3) return 0.65;
  return 0.2;
}

function countAccounts(data, description) {
  const listed = new Set(asText(data.accounts).split(',').map((name) => name.trim()).filter(Boolean));
  if (listed.size > 0) return listed.size;
  const number = description.match(/계정\s*(\d+)\s*개/) || description.match(/(\d+)\s*개\s*계정/);
  if (number) return Number(number[1]);
  const word = description.match(/(두|세|네)\s*계정/);
  if (word) return { 두: 2, 세: 3, 네: 4 }[word[1]];
  if (description.includes('여러 계정')) return 3;
  return 0;
}

// 패턴 2: 같은 비밀번호를 서로 다른 계정에 넣을수록 뚜렷합니다.
function sprayStrength(accounts, description) {
  if (accounts < 2) return 0;
  if (!description.includes('실패') && !description.includes('비밀번호')) return 0;
  const samePassword = description.includes('같은 비밀번호');
  if (samePassword) {
    if (accounts >= 5) return 0.95;
    if (accounts >= 3) return 0.8;
    return 0.65;
  }
  return accounts >= 5 ? 0.7 : 0.5;
}

// 실패 뒤에 성공이 섞였거나 시간이 10분을 넘게 퍼졌으면 '짧은 시간의 연속 공격'에서 멀어집니다.
function contextFactor(description) {
  let factor = 1;
  if (/성공(했|이 있)/.test(description)) factor *= 0.9;
  const minutes = description.match(/(\d+)\s*분/);
  if (minutes && Number(minutes[1]) > 10) factor *= 0.8;
  return factor;
}

export function decide(alert) {
  const source = alert !== null && typeof alert === 'object' ? alert : {};
  const data = source.data !== null && typeof source.data === 'object' ? source.data : {};
  const rule = source.rule !== null && typeof source.rule === 'object' ? source.rule : {};
  const description = asText(rule.description);

  const burst = burstStrength(asNumber(data.count), description);
  const spray = sprayStrength(countAccounts(data, description), description);
  const best = spray > burst ? 1 : 0;
  const patternScore = Math.max(burst, spray) * contextFactor(description);
  const levelScore = clamp01((asNumber(rule.level) - 2) / 8);

  const confidence = Math.round(clamp01(PATTERN_WEIGHT * patternScore + LEVEL_WEIGHT * levelScore) * 100) / 100;
  const pattern = PATTERNS[best];

  if (confidence >= BLOCK_AT) {
    return { action: 'block', confidence, reason: `패턴 「${pattern.name}」(${pattern.mitre})에 뚜렷하게 맞음` };
  }
  if (confidence >= ALERT_AT) {
    return { action: 'alert', confidence, reason: `패턴 「${pattern.name}」(${pattern.mitre})에 일부만 맞아 애매함` };
  }
  if (patternScore > 0) {
    return { action: 'record', confidence, reason: `패턴 「${pattern.name}」에 가깝지만 뚜렷하지 않아 기록만 함` };
  }
  return { action: 'record', confidence, reason: '알려진 무차별 대입 패턴에 맞지 않아 기록만 함' };
}
