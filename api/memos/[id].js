import { authorize, dbFailed, isUuid, methodNotAllowed, readMemoInput }
  from '../../src/memo-api.mjs';

// GET·PUT·DELETE /api/memos/:id
// 4단계: 서버가 토큰으로 확인한 userId와 DB의 owner_id가 같은 행만 다룹니다.
// URL·본문의 owner_id는 믿지 않습니다. 남의 메모와 없는 메모는 같은 404로 답해서
// 메모가 있는지조차 알려 주지 않습니다. 비교는 DB 쿼리 안(.eq('owner_id', userId))에서
// 한 번에 해서, 확인과 사용 사이에 소유자가 바뀌는 틈이 없습니다.
export default async function handler(request, response) {
  if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
    methodNotAllowed(response, 'GET, PUT, DELETE');
    return;
  }
  const session = await authorize(request, response);
  if (!session) return;
  const { userId, supabase } = session;

  const id = typeof request.query?.id === 'string' ? request.query.id.toLowerCase() : '';
  if (!isUuid(id)) { response.status(400).json({ error: 'INVALID_ID' }); return; }

  try {
    if (request.method === 'GET') {
      const { data, error } = await supabase.from('memos').select('id, title, body')
        .eq('id', id).eq('owner_id', userId).maybeSingle();
      if (error) { dbFailed(response, 'MEMO_READ_FAILED', error); return; }
      if (!data) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      response.status(200).json({ id: data.id, title: data.title, body: data.body });
      return;
    }

    if (request.method === 'PUT') {
      const parsed = readMemoInput(request.body, { allowId: false, userId });
      if (parsed.error === 'OWNER_CHANGE_FORBIDDEN') {
        response.status(403).json({ error: parsed.error });
        return;
      }
      if (parsed.error) { response.status(400).json({ error: parsed.error }); return; }
      // 기존 행의 소유자가 본인이어야 고쳐지고(.eq), 새 행의 소유자도 본인으로 고정합니다(owner_id: userId).
      const { data, error } = await supabase.from('memos')
        .update({ title: parsed.value.title, body: parsed.value.body, owner_id: userId,
          updated_at: new Date().toISOString() })
        .eq('id', id).eq('owner_id', userId).select('id');
      if (error) { dbFailed(response, 'MEMO_UPDATE_FAILED', error); return; }
      if (!data?.length) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      response.status(200).json({ id });
      return;
    }

    const { data, error } = await supabase.from('memos').delete()
      .eq('id', id).eq('owner_id', userId).select('id');
    if (error) { dbFailed(response, 'MEMO_DELETE_FAILED', error); return; }
    if (!data?.length) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.status(200).json({ id });
  } catch {
    console.error('MEMO_REQUEST_FAILED');
    response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}
