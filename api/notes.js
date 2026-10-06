import { createClient } from '@supabase/supabase-js';

// 2단계: 가상 메모는 Supabase 테이블 archive_notes에 있고, 이 함수만 서버 전용 키로 읽습니다.
// 알려진 약점: 이 함수 주소(/api/notes)는 아직 로그인 없이 누구나 열 수 있습니다. README 참고.
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
