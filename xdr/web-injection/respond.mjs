// decide.mjs 가 돌려준 결과 가운데 block 만 거부 규칙 저장소에 넣고, 알림을 xdr/alerts.log 에 한 줄씩 쌓습니다.
// decide.mjs 는 이 파일을 모릅니다. 파일 쓰기와 규칙 저장은 모두 여기서만 합니다.
// 규칙은 출발 주소만 대상으로 합니다. 경보의 계정은 공격받은 정상 사용자일 수 있어서 막지 않습니다.
// src/decider.mjs 와 그 RULE_IDS 는 고치지 않습니다. 판정기가 findDenyRule 을 부르는 연결은 아직 하지 않았습니다.
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decide } from './decide.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_RULES_PATH = join(HERE, 'deny-rules.json');
export const DEFAULT_LOG_PATH = join(HERE, '..', 'alerts.log');
const FIXTURE_PATH = join(HERE, '..', 'fixtures', 'web-injection.json');

export const RULE_ID = 'xdr.web_injection.deny';
export const RULES_SCHEMA = 'aleph.xdr.deny-rules.v1';
export const TTL_MS = 60 * 60 * 1000;

// 내 쪽 네트워크(사설·루프백·링크로컬)와 특수 대역은 정상 사용자일 수 있어 규칙 대상에서 뺍니다.
export function isBlockableIp(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}

function oneLine(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 200);
}

export async function loadDenyRules(rulesPath = DEFAULT_RULES_PATH) {
  try {
    const stored = JSON.parse(await readFile(rulesPath, 'utf8'));
    return stored?.schema === RULES_SCHEMA && Array.isArray(stored.rules) ? stored.rules : [];
  } catch {
    return [];
  }
}

// 판정기 쪽에서 요청의 출발 주소로 이 함수를 부르면, 만료되지 않은 거부 규칙이 있을 때만 규칙을 돌려줍니다.
export function findDenyRule(rules, subject, now = new Date()) {
  const srcip = subject?.srcip;
  if (!isBlockableIp(srcip) || !Array.isArray(rules)) return null;
  const nowMs = now.getTime();
  return rules.find((rule) => rule?.srcip === srcip && Date.parse(rule.expiresAt) > nowMs) ?? null;
}

async function saveRules(rulesPath, rules) {
  await mkdir(dirname(rulesPath), { recursive: true });
  const temp = `${rulesPath}.tmp`;
  await writeFile(temp, `${JSON.stringify({ schema: RULES_SCHEMA, rules }, null, 2)}\n`, 'utf8');
  await rename(temp, rulesPath);
}

export async function respondToAlerts(alerts, { now = new Date(), rulesPath = DEFAULT_RULES_PATH, logPath = DEFAULT_LOG_PATH, ttlMs = TTL_MS } = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('경보 배열이 아닙니다.');
  const stamp = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  const judged = [];
  for (const alert of alerts) judged.push({ alert, result: await decide(alert) });

  // 정상(record) 이벤트에 나온 주소는 정상 사용자가 쓸 수 있으니 규칙을 만들지 않습니다.
  const normalIps = new Set(judged
    .filter(({ result }) => result.action === 'record')
    .map(({ alert }) => alert?.data?.srcip)
    .filter((ip) => typeof ip === 'string'));

  const byIp = new Map();
  const lines = [];
  let skipped = 0;
  for (const { alert, result } of judged) {
    if (result.action === 'record') continue;
    const alertId = typeof alert?.id === 'string' ? alert.id.trim() : '';
    const srcip = alert?.data?.srcip;
    const head = [stamp, result.action, oneLine(alertId) || '(id 없음)', oneLine(srcip) || '(주소 없음)'];

    if (result.action === 'alert') {
      lines.push([...head, `확신도 ${result.confidence}`, '알림만, 규칙 없음', oneLine(result.reason)].join('\t'));
      continue;
    }

    let why = '';
    if (!alertId) why = '근거 경보 번호가 없어 규칙을 만들지 않음';
    else if (!isBlockableIp(srcip)) why = '막을 수 있는 공개 IPv4 주소가 아니어서 규칙을 만들지 않음';
    else if (normalIps.has(srcip)) why = '정상 이벤트와 주소가 겹쳐 규칙을 만들지 않음';

    if (why) {
      skipped += 1;
      lines.push([...head, `확신도 ${result.confidence}`, why, oneLine(result.reason)].join('\t'));
      continue;
    }
    // 같은 주소에서 block 이 여러 건이면 규칙은 하나로 두고, 근거 경보 번호를 모두 적습니다.
    const prev = byIp.get(srcip);
    if (prev) {
      prev.alertIds.push(alertId);
      if (result.confidence > prev.confidence) {
        prev.alertId = alertId;
        prev.confidence = result.confidence;
        prev.reason = oneLine(result.reason);
      }
    } else {
      byIp.set(srcip, { ruleId: RULE_ID, srcip, alertId, alertIds: [alertId], confidence: result.confidence, createdAt: stamp, expiresAt, reason: oneLine(result.reason) });
    }
    lines.push([...head, `확신도 ${result.confidence}`, `거부 규칙 추가, 만료 ${expiresAt}`, oneLine(result.reason)].join('\t'));
  }

  // 같은 주소로 다시 흘리면 규칙을 새로 늘리지 않고 새 규칙(만료 시각 갱신)으로 바꿉니다.
  const newRules = [...byIp.values()];
  const nowMs = now.getTime();
  const kept = (await loadDenyRules(rulesPath)).filter((rule) => Date.parse(rule?.expiresAt) > nowMs
    && !byIp.has(rule.srcip));
  const rules = [...kept, ...newRules];
  await saveRules(rulesPath, rules);

  if (lines.length > 0) {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, `${lines.join('\n')}\n`, 'utf8');
  }
  return { rules, added: newRules.length, skipped, notified: lines.length };
}

export async function respondFromFixture(options = {}) {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'web-injection' || !Array.isArray(fixture.alerts)) {
    throw new Error('경보 묶음 형식이 아닙니다.');
  }
  return respondToAlerts(fixture.alerts, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  respondFromFixture()
    .then((summary) => {
      console.log(`거부 규칙 ${summary.added}건 추가, 건너뜀 ${summary.skipped}건, 알림 ${summary.notified}줄 기록`);
      console.log(`현재 유효한 규칙 ${summary.rules.length}건 (만료는 규칙마다 expiresAt)`);
    })
    .catch((error) => {
      console.error(`연결 실패: ${error.message}`);
      process.exitCode = 1;
    });
}
