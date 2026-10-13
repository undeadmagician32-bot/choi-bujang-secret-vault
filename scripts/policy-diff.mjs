import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 읽기 전용: 안전 정책 사본과 현재 정책 파일의 차이만 보여 줍니다. 아무 파일도 쓰지 않습니다.
export const POLICY_FILES = [
  'aleph.config.json', 'vercel.json', 'src/decider.mjs',
  'src/detect.mjs', 'src/resources.mjs', 'docs/MEMOS_RLS.sql',
];
export const SNAPSHOT_SCHEMA = 'policy-snapshot.v1';
const DETAIL_LINE_CAP = 40;
const LCS_CELL_CAP = 4_000_000;

export class PolicyDiffAbort extends Error {}

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export function snapshotVersion(files) {
  const rows = POLICY_FILES.map((path) => [path, files[path].sha256]);
  return sha256(JSON.stringify(rows)).slice(0, 7);
}

const abort = (message) => { throw new PolicyDiffAbort(message); };

export function loadSnapshot(snapshotPath, expectVersion) {
  if (!existsSync(snapshotPath)) abort('안전 정책 사본이 없습니다. 검증한 사본이 있어야 차이를 볼 수 있습니다.');
  let snap;
  try { snap = JSON.parse(readFileSync(snapshotPath, 'utf8')); } catch { abort('안전 정책 사본을 읽을 수 없습니다(JSON 형식 오류).'); }
  if (snap === null || typeof snap !== 'object' || snap.schema !== SNAPSHOT_SCHEMA) abort('안전 정책 사본의 형식(schema)이 맞지 않습니다.');
  if (typeof snap.version !== 'string' || !/^[0-9a-f]{7}$/.test(snap.version)) abort('안전 정책 사본의 버전이 7자리 16진수가 아닙니다.');
  if (typeof snap.createdAt !== 'string' || Number.isNaN(Date.parse(snap.createdAt))) abort('안전 정책 사본의 만든 시각이 올바르지 않습니다.');
  const files = snap.files;
  if (files === null || typeof files !== 'object' || Array.isArray(files)) abort('안전 정책 사본에 files 항목이 없습니다.');
  const keys = Object.keys(files).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...POLICY_FILES].sort())) abort('안전 정책 사본의 파일 목록이 정책 파일 여섯 개와 다릅니다.');
  for (const path of POLICY_FILES) {
    const entry = files[path];
    if (entry === null || typeof entry !== 'object' || typeof entry.content !== 'string'
        || typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) abort(`안전 정책 사본의 ${path} 항목 형식이 맞지 않습니다.`);
    if (sha256(entry.content) !== entry.sha256) abort(`안전 정책 사본 검증 실패: ${path}의 내용이 기록된 해시와 다릅니다.`);
  }
  if (snapshotVersion(files) !== snap.version) abort('안전 정책 사본 검증 실패: 버전이 파일 해시와 맞지 않습니다.');
  if (expectVersion !== undefined && expectVersion !== snap.version) abort(`안전 정책 사본 검증 실패: 기대한 버전 ${expectVersion}과 사본 버전 ${snap.version}이 다릅니다.`);
  return snap;
}

const normalize = (text) => text.replace(/\r\n/g, '\n');

function mask(line) {
  return line
    .replace(/eyJ[\w-]{10,}\.[\w-]+\.[\w-]+/g, '[가림]')
    .replace(/\b(?:sb_secret_|sk-|ghp_)[\w-]+/g, '[가림]')
    .replace(/[A-Za-z0-9+/_-]{40,}/g, '[가림]');
}

// 줄 단위 비교. 너무 큰 파일은 줄 수만 비교합니다.
export function lineDiff(before, after) {
  const a = normalize(before).split('\n');
  const b = normalize(after).split('\n');
  if (a.length * b.length > LCS_CELL_CAP) return { removed: a.length, added: b.length, ops: null };
  const w = b.length + 1;
  const t = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i * w + j] = a[i] === b[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    }
  }
  const ops = [];
  let i = 0; let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (j >= b.length || (i < a.length && t[(i + 1) * w + j] >= t[i * w + j + 1])) ops.push({ sign: '-', line: i + 1, text: a[i++] });
    else ops.push({ sign: '+', line: j + 1, text: b[j++] });
  }
  return { removed: ops.filter((o) => o.sign === '-').length, added: ops.filter((o) => o.sign === '+').length, ops };
}

export function comparePolicies(snap, root) {
  return POLICY_FILES.map((path) => {
    const abs = join(root, path);
    if (!existsSync(abs)) return { path, status: 'missing', removed: normalize(snap.files[path].content).split('\n').length, added: 0, ops: [] };
    const current = readFileSync(abs, 'utf8');
    if (normalize(current) === normalize(snap.files[path].content)) return { path, status: 'same', removed: 0, added: 0, ops: [] };
    return { path, status: 'changed', ...lineDiff(snap.files[path].content, current) };
  });
}

export function renderReport(snap, results) {
  const count = (s) => results.filter((r) => r.status === s).length;
  const lines = [
    '정책 사본 차이 보기 (읽기 전용: 아무 파일도 바꾸지 않습니다)',
    `복원할 버전: ${snap.version} (사본 만든 시각 ${snap.createdAt})`,
    `사본 검증: 통과 (파일 ${POLICY_FILES.length}개 해시와 버전 일치)`,
    `변경 범위: 변경 ${count('changed')}개, 현재 없음 ${count('missing')}개, 같음 ${count('same')}개`,
  ];
  for (const r of results) {
    const label = { same: '같음', changed: '변경', missing: '현재 없음' }[r.status];
    lines.push(`  ${label.padEnd(5)} ${r.path}${r.status === 'same' ? '' : `  (-${r.removed} +${r.added})`}`);
  }
  const detailed = results.filter((r) => r.status !== 'same');
  if (detailed.length === 0) lines.push('', '차이가 없습니다. 현재 정책이 사본과 같습니다.');
  for (const r of detailed) {
    lines.push('', `--- ${r.path} (- 사본, + 현재)`);
    if (r.status === 'missing') { lines.push('  현재 파일이 없습니다.'); continue; }
    if (r.ops === null) { lines.push('  파일이 커서 줄 수만 비교했습니다.'); continue; }
    r.ops.slice(0, DETAIL_LINE_CAP).forEach((o) => lines.push(`${o.sign} ${String(o.line).padStart(4)}  ${mask(o.text)}`));
    if (r.ops.length > DETAIL_LINE_CAP) lines.push(`  … 나머지 ${r.ops.length - DETAIL_LINE_CAP}줄은 생략했습니다.`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!['--snapshot', '--root', '--expect-version'].includes(key) || argv[i + 1] === undefined) abort(`알 수 없거나 값이 없는 옵션입니다: ${key}`);
    opts[key.slice(2)] = argv[i + 1];
  }
  return opts;
}

export function run(argv) {
  const opts = parseArgs(argv);
  const root = resolve(opts.root ?? fileURLToPath(new URL('..', import.meta.url)));
  const snap = loadSnapshot(resolve(opts.snapshot ?? join(root, 'backup', 'policy-snapshot.json')), opts['expect-version']);
  return renderReport(snap, comparePolicies(snap, root));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (error) {
    console.log(`중단: ${error instanceof PolicyDiffAbort ? error.message : '예상하지 못한 오류가 났습니다.'}`);
    process.exitCode = 2;
  }
}
