import { postOnly, publicAuthClient, readJsonBody, sessionPayload } from '../../src/auth-api.mjs';

// POST /api/auth/refresh { refresh_token } → 새 세션. 만료되었거나 취소된 토큰이면 401입니다.
export default async function handler(request, response) {
  if (!postOnly(request, response)) return;
  const supabase = publicAuthClient();
  if (!supabase) {
    console.error('AUTH_ENV_MISSING');
    response.status(500).json({ error: 'AUTH_NOT_CONFIGURED' });
    return;
  }
  const input = readJsonBody(request.body);
  const refreshToken = typeof input?.refresh_token === 'string' ? input.refresh_token : '';
  if (!refreshToken || refreshToken.length > 2048) {
    response.status(400).json({ error: 'INVALID_REFRESH' });
    return;
  }
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) {
      console.error('AUTH_REFRESH_FAILED', error?.code ?? error?.status ?? 'unknown');
      response.status(401).json({ error: 'REFRESH_FAILED' });
      return;
    }
    response.status(200).json(sessionPayload(data.session));
  } catch {
    console.error('AUTH_REFRESH_REQUEST_FAILED');
    response.status(502).json({ error: 'REFRESH_FAILED' });
  }
}
