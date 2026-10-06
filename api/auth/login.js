import { postOnly, publicAuthClient, readJsonBody, sessionPayload } from '../../src/auth-api.mjs';

// POST /api/auth/login { email, password } → { access_token, refresh_token, expires_at, email }
// 실패하면 Supabase가 알려 준 이유(message)를 그대로 돌려줘서 화면에 보여 줍니다.
export default async function handler(request, response) {
  if (!postOnly(request, response)) return;
  const supabase = publicAuthClient();
  if (!supabase) {
    console.error('AUTH_ENV_MISSING');
    response.status(500).json({ error: 'AUTH_NOT_CONFIGURED' });
    return;
  }
  const input = readJsonBody(request.body);
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  const password = typeof input?.password === 'string' ? input.password : '';
  if (!email || email.length > 320 || !password || password.length > 1000) {
    response.status(400).json({ error: 'INVALID_LOGIN', message: '이메일과 비밀번호를 적어 주세요.' });
    return;
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      console.error('AUTH_LOGIN_FAILED', error?.code ?? error?.status ?? 'unknown');
      const server = Number(error?.status) >= 500;
      response.status(server ? 502 : 401).json({ error: 'LOGIN_FAILED',
        message: server ? '로그인 서버에 문제가 있습니다.' : (error?.message || '로그인하지 못했습니다.') });
      return;
    }
    response.status(200).json(sessionPayload(data.session));
  } catch {
    console.error('AUTH_LOGIN_REQUEST_FAILED');
    response.status(502).json({ error: 'LOGIN_FAILED', message: '로그인 서버에 연결하지 못했습니다.' });
  }
}
