import { randomUUID } from 'node:crypto';
import { authorize, dbFailed, methodNotAllowed, readMemoInput } from '../../src/memo-api.mjs';

// GET /api/memos  : 로그인한 사용자의 메모 목록
// POST /api/memos : { id?, title, body } → 201 { id }. owner_id는 서버가 확인한 사용자 ID로만 저장합니다.
export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    methodNotAllowed(response, 'GET, POST');
    return;
  }
  const session = await authorize(request, response);
  if (!session) return;
  const { userId, supabase } = session;

  try {
    if (request.method === 'GET') {
      const { data, error } = await supabase.from('memos').select('id, title, body')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true }).order('id', { ascending: true });
      if (error) { dbFailed(response, 'MEMOS_LIST_FAILED', error); return; }
      response.status(200).json(data);
      return;
    }

    const parsed = readMemoInput(request.body, { allowId: true });
    if (parsed.error) { response.status(400).json({ error: parsed.error }); return; }
    const id = parsed.value.id ?? randomUUID();
    const { error } = await supabase.from('memos')
      .insert({ id, owner_id: userId, title: parsed.value.title, body: parsed.value.body });
    if (error?.code === '23505') { response.status(409).json({ error: 'ID_EXISTS' }); return; }
    if (error) { dbFailed(response, 'MEMOS_CREATE_FAILED', error); return; }
    response.status(201).json({ id });
  } catch {
    console.error('MEMOS_REQUEST_FAILED');
    response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}
