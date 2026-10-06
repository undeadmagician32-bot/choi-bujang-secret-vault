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

export const isUuid = (value) => typeof value === 'string' && UUID.test(value);

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
  return { userId: verified.userId, supabase: admin };
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
export function readMemoInput(rawBody, { allowId }) {
  const input = plainObject(rawBody);
  if (!input) return { error: 'INVALID_BODY' };
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

export function dbFailed(response, label, error) {
  // 오류 문구에는 요청 정보가 섞일 수 있어 고정 코드와 오류 코드만 남깁니다.
  console.error(label, error?.code ?? 'unknown');
  response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
}
