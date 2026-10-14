// 10단계 제작 1: 침해 전에 검증한 안전 정책 사본과 현재 시험 정책의 차이만 계산합니다.
// 읽기 전용입니다. 파일·정책·운영 설정을 쓰거나 바꾸지 않습니다. 사본이 없거나 검증에 실패하면 계획을 만들지 않고 중단합니다.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SNAPSHOT_SCHEMA = 'aleph.policy.snapshot.v1';
export const DEFAULT_SNAPSHOT_PATH = 'restore/policy-snapshot.json';

const SNAPSHOT_KEYS = 'capturedAt,digest,policy,schema,version';
const POLICY_KEYS = 'allowedRoutes,identityProvider,originalApiUrl,ruleIds';
const IDP_KEYS = 'audience,issuer,jwksUrl';
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export class RestoreAbort extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RestoreAbort';
    this.code = code;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const keysOf = (v) => Object.keys(v).sort().join(',');
const isTextList = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x)
  && new Set(v).size === v.length;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const digestOf = (policy) => `sha256:${createHash('sha256').update(canonical(policy)).digest('hex')}`;

function policyShapeOk(policy) {
  return isPlainObject(policy) && keysOf(policy) === POLICY_KEYS
    && isTextList(policy.ruleIds) && isTextList(policy.allowedRoutes)
    && typeof policy.originalApiUrl === 'string' && policy.originalApiUrl
    && isPlainObject(policy.identityProvider) && keysOf(policy.identityProvider) === IDP_KEYS
    && Object.values(policy.identityProvider).every((x) => typeof x === 'string' && x);
}

// 사본의 digest는 내용이 깨졌거나 손으로 고쳐졌는지만 알려 줍니다. 사본과 digest를 함께 바꾼 경우까지는 막지 못하므로,
// 사본을 만든 시점의 digest는 저장소 밖(학생 기록)에도 적어 두세요.
export async function loadSnapshot(path) {
  let text;
  try { text = await readFile(path, 'utf8'); } catch {
    throw new RestoreAbort('SNAPSHOT_MISSING', '검증된 정책 사본이 없습니다. 복원 계획을 만들지 않습니다.');
  }
  let snapshot;
  try { snapshot = JSON.parse(text); } catch {
    throw new RestoreAbort('SNAPSHOT_INVALID', '정책 사본이 JSON 형식이 아닙니다.');
  }
  if (!isPlainObject(snapshot) || keysOf(snapshot) !== SNAPSHOT_KEYS || snapshot.schema !== SNAPSHOT_SCHEMA
    || !Number.isInteger(snapshot.version) || snapshot.version < 1
    || typeof snapshot.capturedAt !== 'string' || !ISO_UTC.test(snapshot.capturedAt)
    || typeof snapshot.digest !== 'string' || !policyShapeOk(snapshot.policy)) {
    throw new RestoreAbort('SNAPSHOT_INVALID', '정책 사본의 형식이 계약과 다릅니다.');
  }
  if (digestOf(snapshot.policy) !== snapshot.digest) {
    throw new RestoreAbort('SNAPSHOT_DIGEST_MISMATCH', '정책 사본의 digest가 내용과 맞지 않습니다. 사본이 바뀌었을 수 있습니다.');
  }
  return snapshot;
}

// 현재 시험 정책: 저장소가 실제로 쓰는 값만 읽습니다. 판정기의 숫자 기준값은 내보내지 않으므로 이 비교에 넣지 않았습니다.
export async function readCurrentPolicy(root) {
  const config = JSON.parse(await readFile(join(root, 'aleph.config.json'), 'utf8'));
  const { RULE_IDS } = await import(pathToFileURL(join(root, 'src', 'decider.mjs')).href);
  const idp = config.identityProvider ?? {};
  return {
    ruleIds: [...RULE_IDS],
    allowedRoutes: [...(config.allowedRoutes ?? [])],
    identityProvider: { audience: idp.audience, issuer: idp.issuer, jwksUrl: idp.jwksUrl },
    originalApiUrl: config.originalApiUrl,
  };
}

// 사본(복원 목표)을 기준으로 현재 값이 어떻게 다른지, 복원하면 무엇이 바뀌는지 적습니다.
// restore: 'add' = 복원하면 다시 들어옴, 'remove' = 복원하면 빠짐, 'set' = 사본 값으로 되돌림.
export function diffPolicy(saved, current) {
  const changes = [];
  for (const field of ['ruleIds', 'allowedRoutes']) {
    for (const item of saved[field]) {
      if (!current[field]?.includes(item)) changes.push({ path: field, restore: 'add', value: item });
    }
    for (const item of current[field] ?? []) {
      if (!saved[field].includes(item)) changes.push({ path: field, restore: 'remove', value: item });
    }
  }
  const scalars = [['originalApiUrl', saved.originalApiUrl, current.originalApiUrl],
    ...Object.keys(saved.identityProvider).sort().map((k) => [`identityProvider.${k}`,
      saved.identityProvider[k], current.identityProvider?.[k]])];
  for (const [path, value, now] of scalars) {
    if (value !== now) changes.push({ path, restore: 'set', current: now ?? null, value });
  }
  return changes;
}

export async function planRestore({ root, snapshotPath = join(root, DEFAULT_SNAPSHOT_PATH) }) {
  const snapshot = await loadSnapshot(snapshotPath);
  const current = await readCurrentPolicy(root);
  const changes = diffPolicy(snapshot.policy, current);
  const plan = { version: snapshot.version, capturedAt: snapshot.capturedAt, digest: snapshot.digest, changes };
  return { ...plan, planId: planIdOf(plan) };
}

// 확인 번호: 보여 준 사본 버전·digest·변경 목록이 실행 때와 같을 때만 같은 값이 나옵니다.
export const planIdOf = (plan) => `plan:${createHash('sha256').update(canonical({
  version: plan.version, digest: plan.digest, changes: plan.changes })).digest('hex').slice(0, 16)}`;

// 이 절차가 자동으로 되돌리는 항목은 aleph.config.json에 있는 값뿐입니다. 규칙 이름은 코드(src/decider.mjs)에 있습니다.
export const isCodeChange = (change) => change.path === 'ruleIds';

export function formatPlan(plan) {
  const lines = [
    `복원할 버전: ${plan.version} (사본 시각 ${plan.capturedAt})`,
    `사본 digest: ${plan.digest}`,
    `확인 번호: ${plan.planId}`,
    `변경 범위: ${plan.changes.length}건 (읽기 전용 미리보기, 아무것도 바꾸지 않았습니다)`,
  ];
  for (const c of plan.changes) {
    if (isCodeChange(c)) lines.push(`  ! ${c.path}: ${c.value}  (코드 항목: 자동 복원하지 않음, ${c.restore === 'add' ? '사본에만 있음' : '현재에만 있음'})`);
    else if (c.restore === 'add') lines.push(`  + ${c.path}: ${c.value}  (복원하면 다시 들어옴)`);
    else if (c.restore === 'remove') lines.push(`  - ${c.path}: ${c.value}  (복원하면 빠짐)`);
    else lines.push(`  ~ ${c.path}: 현재 ${c.current ?? '(없음)'} → 사본 ${c.value}`);
  }
  if (!plan.changes.length) lines.push('  차이 없음');
  return lines.join('\n');
}
