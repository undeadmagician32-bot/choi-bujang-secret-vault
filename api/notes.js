import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';
import { markResource } from '../src/resources.mjs';

// 2단계: 가상 메모는 Supabase 테이블 archive_notes에 있고, 이 함수만 서버 전용 키로 읽습니다.
// 3단계: 요청의 Authorization 토큰을 src/verify-login.mjs로 서버에서 검사하고, 통과해야만 자료를 읽습니다.
// 브라우저가 보낸 userId·role 같은 값은 쓰지 않고, 검사 결과(verified)만 믿습니다.
// 알려진 약점: 허용 경로 검사와 호출 횟수 제한은 아직 없습니다. README 참고.
let verifier;
function getVerifier(key) {
  verifier ??= createLoginVerifier({ config, supabaseSecretKey: key });
  return verifier;
}

// 8단계: 공지 수정 요청은 로그인한 사용자라도 서버에 저장된 강사 권한이 있어야 합니다.
// 화면 메뉴나 요청 본문·쿼리의 role은 읽지 않습니다. 이 자료실에는 아직 강사 권한을 저장한 곳이 없어
// 누구의 수정도 허용하지 않고(403), 공지 수정 API 자체도 아직 없습니다.
const NOTICE_WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const hasStoredInstructorRole = () => false;

async function denyNoticeWrite(request, response) {
  const key = process.env.SUPABASE_SECRET_KEY;
  let verified = null;
  try {
    if (process.env.SUPABASE_URL && key) verified = await getVerifier(key)(request.headers.authorization);
  } catch {
    verified = null;
  }
  if (!verified) {
    console.warn('NOTICE_DENIED', 'login_required');
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  if (!hasStoredInstructorRole(verified.userId)) {
    console.warn('NOTICE_DENIED', 'instructor_not_verified');
    response.status(403).json({ error: 'INSTRUCTOR_REQUIRED' });
    return;
  }
  response.setHeader('Allow', 'GET');
  response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (NOTICE_WRITE_METHODS.includes(request.method)) {
    await denyNoticeWrite(request, response);
    return;
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  markResource(response, 'GET /api/notes');

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
