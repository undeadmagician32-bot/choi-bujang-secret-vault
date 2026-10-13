// 확인용 읽기 모듈입니다. decide.mjs 가 불러오지 않습니다.
// xdr/fixtures/known-cve.json 을 읽기만 하고, 시각·출발 주소·계정·규칙 수준·설명 다섯 값만 뽑습니다.
// 원본 경보는 고치지 않으며, 비밀값처럼 보이는 문자열은 [가림] 으로 바꿔 출력합니다.
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MASK = '[가림]';
const SECRET_PATTERNS = [
  /\b(?:password|passwd|pwd|pass|token|secret|api[_-]?key|apikey|authorization)\s*[=:]\s*\S+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g,
  /\b(?:sk|pk|ghp|gho|xox[bap])[-_][A-Za-z0-9_-]{16,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /\b[A-Za-z0-9+/_-]{32,}={0,2}/g,
];

export function maskSecrets(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, MASK);
  return text.replace(/[\t\r\n]+/g, ' ').trim();
}

export function pickAlert(alert) {
  return {
    time: maskSecrets(alert?.timestamp),
    srcip: maskSecrets(alert?.data?.srcip),
    user: maskSecrets(alert?.data?.srcuser),
    level: maskSecrets(alert?.rule?.level),
    description: maskSecrets(alert?.rule?.description),
  };
}

export async function readAlerts({ root }) {
  const fixture = JSON.parse(await readFile(join(root, 'xdr', 'fixtures', 'known-cve.json'), 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'known-cve' || !Array.isArray(fixture.alerts)) {
    throw new Error('경보 묶음 형식이 아닙니다.');
  }
  const rows = fixture.alerts.map(pickAlert);
  return { alertCount: fixture.alerts.length, rows };
}

export function formatRow(row) {
  return [row.time, row.srcip, row.user, row.level, row.description].join('\t');
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { alertCount, rows } = await readAlerts({ root });
  const lines = rows.map(formatRow);
  for (const line of lines) console.log(line);
  const same = alertCount === lines.length;
  console.log(`경보 ${alertCount}건, 뽑은 줄 ${lines.length}줄: ${same ? '같음' : '다름'}`);
  if (!same) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`읽기 실패: ${error.message}`);
    process.exitCode = 1;
  });
}
