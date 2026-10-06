import { adminAuthClient, bearerToken, postOnly } from '../../src/auth-api.mjs';

// POST /api/auth/logout (Authorization: Bearer 토큰) → 이 로그인 세션을 서버에서 취소합니다.
// 토큰이 없으면 401입니다. 화면은 응답과 상관없이 저장해 둔 세션을 지웁니다.
export default async function handler(request, response) {
  if (!postOnly(request, response)) return;
  const token = bearerToken(request.headers.authorization);
  if (!token) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  const supabase = adminAuthClient();
  if (!supabase) {
    console.error('AUTH_ENV_MISSING');
    response.status(500).json({ error: 'AUTH_NOT_CONFIGURED' });
    return;
  }
  try {
    const { error } = await supabase.auth.admin.signOut(token, 'local');
    if (error) {
      console.error('AUTH_LOGOUT_FAILED', error.code ?? error.status ?? 'unknown');
      response.status(502).json({ error: 'LOGOUT_FAILED' });
      return;
    }
    response.status(200).json({ ok: true });
  } catch {
    console.error('AUTH_LOGOUT_REQUEST_FAILED');
    response.status(502).json({ error: 'LOGOUT_FAILED' });
  }
}
