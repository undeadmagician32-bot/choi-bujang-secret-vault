import { authorize, dbFailed, isUuid, methodNotAllowed, readMemoInput }
  from '../../src/memo-api.mjs';

// GET·PUT·DELETE /api/memos/:id
// 알려진 약점(4단계에서 고침): 아직 소유자 검사가 없어서, 로그인한 사용자는 id만 알면
// 다른 사용자의 메모도 읽고 고치고 지울 수 있습니다. 로그인 검사만 합니다.
export default async function handler(request, response) {
  if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
    methodNotAllowed(response, 'GET, PUT, DELETE');
    return;
  }
  const session = await authorize(request, response);
  if (!session) return;
  const { supabase } = session;

  const id = typeof request.query?.id === 'string' ? request.query.id.toLowerCase() : '';
  if (!isUuid(id)) { response.status(400).json({ error: 'INVALID_ID' }); return; }

  try {
    if (request.method === 'GET') {
      const { data, error } = await supabase.from('memos').select('id, title, body')
        .eq('id', id).maybeSingle();
      if (error) { dbFailed(response, 'MEMO_READ_FAILED', error); return; }
      if (!data) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      response.status(200).json(data);
      return;
    }

    if (request.method === 'PUT') {
      const parsed = readMemoInput(request.body, { allowId: false });
      if (parsed.error) { response.status(400).json({ error: parsed.error }); return; }
      const { data, error } = await supabase.from('memos')
        .update({ title: parsed.value.title, body: parsed.value.body, updated_at: new Date().toISOString() })
        .eq('id', id).select('id');
      if (error) { dbFailed(response, 'MEMO_UPDATE_FAILED', error); return; }
      if (!data?.length) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      response.status(200).json({ id });
      return;
    }

    const { data, error } = await supabase.from('memos').delete().eq('id', id).select('id');
    if (error) { dbFailed(response, 'MEMO_DELETE_FAILED', error); return; }
    if (!data?.length) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.status(200).json({ id });
  } catch {
    console.error('MEMO_REQUEST_FAILED');
    response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}
