import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

// 2단계: 가상 메모는 Supabase 테이블 archive_notes에 있고, 이 함수만 서버 전용 키로 읽습니다.
// 3단계: 요청의 Authorization 토큰을 src/verify-login.mjs로 서버에서 검사하고, 통과해야만 자료를 읽습니다.
// 브라우저가 보낸 userId·role 같은 값은 쓰지 않고, 검사 결과(verified)만 믿습니다.
// 알려진 약점: 허용 경로 검사와 호출 횟수 제한은 아직 없습니다. README 참고.
let verifier;
function getVerifier(key) {
  verifier ??= createLoginVerifier({ config, supabaseSecretKey: key });
  return verifier;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('NOTES_ENV_MISSING');
    response.status(500).json({ error: 'NOTES_NOT_CONFIGURED' });
    return;
  }

  // 검사기를 만들지 못하거나 토큰 검사가 실패하면 자료 없이 거부합니다.
  let verified;
  try {
    verified = await getVerifier(key)(request.headers.authorization);
  } catch {
    console.error('NOTES_VERIFIER_FAILED');
    response.status(500).json({ error: 'NOTES_NOT_CONFIGURED' });
    return;
  }
  if (!verified) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from('archive_notes')
      .select('title, content')
      .order('created_at', { ascending: true })
      .order('title', { ascending: true });
    if (error) {
      // 오류 문구에는 요청 정보가 섞일 수 있어 고정 코드와 오류 코드만 남깁니다.
      console.error('NOTES_QUERY_FAILED', error.code ?? 'unknown');
      response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
      return;
    }
    response.status(200).json({ notes: data });
  } catch {
    console.error('NOTES_REQUEST_FAILED');
    response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
  }
}
