import { createClient } from '@supabase/supabase-js';

// 5단계: 화면 코드에는 Supabase 키를 두지 않고, 로그인·세션 갱신·로그아웃을 서버 함수가 맡습니다.
// 서버가 공식 SDK(signInWithPassword, refreshSession, auth.admin.signOut)를 부릅니다.
// 비밀번호와 토큰은 만들지도 저장하지도 않고, 로그에는 고정 코드만 남깁니다.
// 필요한 설정: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY(로그인 도구용), SUPABASE_SECRET_KEY(로그아웃용).
const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;

export function publicAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key, OPTIONS) : null;
}

export function adminAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? createClient(url, key, OPTIONS) : null;
}

export function bearerToken(authorization) {
  return typeof authorization === 'string' && authorization.length <= 8192
    ? BEARER.exec(authorization)?.[1] ?? null : null;
}

export function readJsonBody(rawBody) {
  let value = rawBody;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

// 화면에 보낼 세션 값만 추립니다. 사용자 ID·역할 같은 값은 보내지 않습니다.
export function sessionPayload(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    email: session.user?.email ?? '',
  };
}

export function postOnly(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'POST') return true;
  response.setHeader('Allow', 'POST');
  response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  return false;
}
