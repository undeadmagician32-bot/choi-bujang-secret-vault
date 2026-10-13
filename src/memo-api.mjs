import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from './verify-login.mjs';

// 3단계 메모 API 공통 부분: 서버가 토큰을 검사해 얻은 userId만 믿고, 입력은 여기서 검사합니다.
// 브라우저가 보낸 userId·role·owner_id 같은 값은 읽지 않습니다.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const TITLE_MAX = 200;
export const BODY_MAX = 5000;

let verifier;
let admin;

// 10단계: 사본 대조용 내용 해시. sha256(제목 || 0x00 || 본문), 소문자 16진수. docs/MEMOS_BACKUP.sql과 같은 계산입니다.
export const memoContentSha256 = (title, body) => createHash('sha256')
  .update(Buffer.concat([Buffer.from(title, 'utf8'), Buffer.from([0]), Buffer.from(body, 'utf8')])).digest('hex');

// 10단계: 심판 토큰은 같은 sub로 A·B 두 신원(identity 'a'/'b')을 쓸 수 있습니다. sub만 주인으로 쓰면 B가 A의 메모를
// 자기 것으로 다룰 수 있어서, 심판 토큰이면 sub와 identity를 묶어 만든 고정 UUID를 주인 키로 씁니다.
// 학생 토큰은 서버가 확인한 sub 그대로입니다. 브라우저가 보낸 값은 쓰지 않습니다.
export function ownerKeyFor(verified) {
  if (verified?.kind !== 'judge') return verified.userId;
  const hex = createHash('sha256').update(`aleph-judge-owner\0${verified.userId}\0${verified.identity}`).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// 10단계: 메모를 새로 만들 때 비공개 사본을 덧붙입니다. 이미 사본이 있으면 건드리지 않아(on conflict do nothing)
// 사본은 가장 이른 내용으로 남습니다. 사본 쓰기가 실패해도 메모 만들기는 실패시키지 않고 고정 코드만 남깁니다.
export async function saveMemoBackup(supabase, { id, owner_id, title, body }) {
  try {
    const { error } = await supabase.from('memos_backup').upsert(
      { id, owner_id, title, body, content_sha256: memoContentSha256(title, body) },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) { console.error('MEMO_BACKUP_FAILED', error.code ?? 'unknown'); return false; }
    return true;
  } catch {
    console.error('MEMO_BACKUP_FAILED', 'unknown');
    return false;
  }
}

export const isUuid =(value) => typeof value === 'string' && UUID.test(value);

// 통과하면 { userId, supabase }를 돌려주고, 거부하면 응답을 이미 보낸 뒤 null을 돌려줍니다.
export async function authorize(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('MEMOS_ENV_MISSING');
    response.status(500).json({ error: 'MEMOS_NOT_CONFIGURED' });
    return null;
  }
  let verified;
  try {
    verifier ??= createLoginVerifier({ config, supabaseSecretKey: key });
    verified = await verifier(request.headers.authorization);
  } catch {
    console.error('MEMOS_VERIFIER_FAILED');
    response.status(500).json({ error: 'MEMOS_NOT_CONFIGURED' });
    return null;
  }
  if (!verified) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return null;
  }
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { userId: ownerKeyFor(verified), supabase: admin };
}

export function methodNotAllowed(response, allow) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Allow', allow);
  response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}

// Vercel은 JSON 본문을 객체로 풀어 주지만, 그렇지 않은 경우도 안전하게 처리합니다.
function plainObject(body) {
  let value = body;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

// 돌려주는 값: { value: { id?, title, body } } 또는 { error: 고정 코드 }
// userId를 주면 수정 요청이므로, 본문에 본인이 아닌 owner_id가 있을 때 소유자 변경 시도로 거부합니다.
// 본문의 owner_id는 값으로 쓰지 않고, 같은 값이어도 저장에 쓰지 않습니다.
export function readMemoInput(rawBody, { allowId, userId }) {
  const input = plainObject(rawBody);
  if (!input) return { error: 'INVALID_BODY' };
  if (userId !== undefined) {
    for (const key of ['owner_id', 'ownerId']) {
      if (input[key] !== undefined && input[key] !== userId) return { error: 'OWNER_CHANGE_FORBIDDEN' };
    }
  }
  if (typeof input.title !== 'string' || typeof input.body !== 'string') return { error: 'INVALID_MEMO' };
  const title = input.title.trim();
  if (!title || title.length > TITLE_MAX || input.body.length > BODY_MAX) return { error: 'INVALID_MEMO' };
  const value = { title, body: input.body };
  if (allowId && input.id !== undefined && input.id !== null) {
    if (!isUuid(input.id)) return { error: 'INVALID_ID' };
    value.id = input.id.toLowerCase();
  }
  return { value };
}

// 8단계: 소유자 검사로 404를 돌려줄 때 거부 사유를 짧게 남깁니다. 사용자 ID·메모 ID·본문은 남기지 않고,
// 응답은 그대로 404여서 남의 메모가 있는지 알려 주지 않습니다.
export async function logMemoDenied(supabase, id) {
  try {
    const { data } = await supabase.from('memos').select('id').eq('id', id).maybeSingle();
    console.warn('MEMO_DENIED', data ? 'not_owner' : 'not_found');
  } catch {
    console.warn('MEMO_DENIED', 'unknown');
  }
}

export function dbFailed(response, label, error) {
  // 오류 문구에는 요청 정보가 섞일 수 있어 고정 코드와 오류 코드만 남깁니다.
  console.error(label, error?.code ?? 'unknown');
  response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
}
