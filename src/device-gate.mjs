import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

// 11단계 기기 승인: 이 기기가 등록 기기인지는 서버 표(device_registrations)의 status만으로 정합니다.
// - 기기 비밀값은 서버가 만들어 HttpOnly 쿠키로만 보냅니다. 화면 코드(JS)와 브라우저 저장소는 읽지도 쓰지도 않습니다.
// - 표에는 비밀값의 SHA-256 해시만 저장합니다. 브라우저가 보낸 "승인됨" 같은 값은 읽지 않습니다.
// - '승인 요청'은 pending 행만 만듭니다. approved로 바꾸는 일은 앱 밖(운영자의 DB 작업)에서만 합니다.
// - 이 표는 학생 앱의 서버 쪽 기기 등록부입니다. 반 엔진의 deviceRegistered(판정기 요청 항목)와는 별개입니다.
export const COOKIE_NAME = 'vault_device';
export const MAX_PENDING_PER_OWNER = 3;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const COOKIE_VALUE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/u;
const LABEL = /^[\p{L}\p{N} _.-]{1,40}$/u;
const STATES = new Set(['pending', 'approved', 'revoked']);

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export function newCredential() {
  const id = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  return { id, cookieValue: `${id}.${secret}`, secretHash: sha256(secret) };
}

export const setCookieHeader = (cookieValue) =>
  `${COOKIE_NAME}=${cookieValue}; Max-Age=${COOKIE_MAX_AGE}; Path=/api; HttpOnly; Secure; SameSite=Strict`;

export function parseDeviceCookie(header) {
  if (typeof header !== 'string' || header.length > 4096) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== COOKIE_NAME) continue;
    const match = COOKIE_VALUE.exec(rest.join('='));
    return match ? { id: match[1], secretHash: sha256(match[2]) } : null;
  }
  return null;
}

const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string'
  && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// 돌려주는 값: { state: 'none' | 'pending' | 'approved' | 'revoked', id? }
// 쿠키가 없거나, 행이 없거나, 소유자·비밀값이 다르면 모두 'none'이라 남의 기기 행이 있는지 알려 주지 않습니다.
export async function deviceStatus({ store, userId, cookieHeader }) {
  const cookie = parseDeviceCookie(cookieHeader);
  if (!cookie) return { state: 'none' };
  const row = await store.findById(cookie.id);
  if (!row || row.owner_id !== userId || !sameHash(row.secret_hash, cookie.secretHash)
      || !STATES.has(row.status)) return { state: 'none' };
  return { state: row.status, id: row.id };
}

// 승인 요청. 이미 pending·approved·revoked인 기기는 새 행을 만들지 않고 현재 상태만 돌려줍니다(revoked는 스스로 되살리지 못함).
export async function requestDevice({ store, userId, cookieHeader, input }) {
  const label = input?.label;
  if (label !== undefined && (typeof label !== 'string' || !LABEL.test(label.trim()))) {
    return { status: 400, body: { error: 'INVALID_LABEL' } };
  }
  const current = await deviceStatus({ store, userId, cookieHeader });
  if (current.state !== 'none') return { status: 200, body: current };
  if (await store.countPending(userId) >= MAX_PENDING_PER_OWNER) {
    return { status: 429, body: { error: 'TOO_MANY_PENDING' } };
  }
  const credential = newCredential();
  await store.insert({
    id: credential.id, owner_id: userId, secret_hash: credential.secretHash,
    status: 'pending', label: label === undefined ? null : label.trim(),
  });
  return { status: 201, body: { state: 'pending', id: credential.id }, setCookie: setCookieHeader(credential.cookieValue) };
}

export function supabaseDeviceStore(supabase) {
  const table = () => supabase.from('device_registrations');
  return {
    async findById(id) {
      const { data, error } = await table().select('id, owner_id, secret_hash, status').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async countPending(ownerId) {
      const { count, error } = await table().select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId).eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    async insert(row) {
      const { error } = await table().insert(row);
      if (error) throw error;
    },
  };
}

// 보호 자료 경로에서 호출합니다. 통과하면 true. 아니면 응답을 이미 보내고 false를 돌려줍니다.
// 판정은 서버 표만 보고, 확인하지 못하면(표 오류 등) 자료 없이 거부합니다.
// 심판 토큰(kind: 'judge')은 반 엔진이 기기를 이미 확인한 요청이라 이 검사를 거치지 않습니다.
export async function gateDevice({ request, response, verified, supabase }) {
  if (verified.kind !== 'student') return true;
  try {
    const { state } = await deviceStatus({
      store: supabaseDeviceStore(supabase), userId: verified.userId, cookieHeader: request.headers.cookie,
    });
    if (state === 'approved') return true;
    console.warn('DEVICE_DENIED', state);
    response.status(403).json({ error: 'DEVICE_NOT_APPROVED', state });
    return false;
  } catch {
    console.error('DEVICE_CHECK_FAILED');
    response.status(503).json({ error: 'DEVICE_CHECK_FAILED' });
    return false;
  }
}
