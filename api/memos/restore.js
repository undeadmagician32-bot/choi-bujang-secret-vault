import { authorize, dbFailed, isUuid, memoContentSha256, methodNotAllowed } from '../../src/memo-api.mjs';
import { markResource } from '../../src/resources.mjs';

// POST /api/memos/restore : { id } → 200 { id, restored: true, contentSha256 }
// 10단계: 비공개 사본(memos_backup)에서 로그인한 본인의 메모 한 건만 되살립니다.
// - 사본은 서버 전용 키로만 읽고, 외부 경로는 없습니다. 사본·다른 메모·감사 기록은 쓰지 않습니다.
// - 사본의 ID·소유자가 요청 ID·확인된 사용자와 같고, 저장된 내용 해시가 제목·본문에서 다시 계산한 값과
//   같을 때만 씁니다. 쓴 뒤 다시 읽어 같은 해시인지 확인합니다.
// - 남의 메모 ID와 사본이 없는 ID는 같은 404로 답합니다. owner_id는 확인된 사용자 ID로만 씁니다.
function readId(rawBody) {
  let body = rawBody;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return { error: 'INVALID_BODY' }; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'INVALID_BODY' };
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'id') return { error: 'INVALID_BODY' };
  if (!isUuid(body.id)) return { error: 'INVALID_ID' };
  return { id: body.id.toLowerCase() };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    methodNotAllowed(response, 'POST');
    return;
  }
  markResource(response, 'POST /api/memos/restore');
  const session = await authorize(request, response);
  if (!session) return;
  const { userId, supabase } = session;

  const parsed = readId(request.body);
  if (parsed.error) { response.status(400).json({ error: parsed.error }); return; }
  const { id } = parsed;

  try {
    const { data: backup, error: readError } = await supabase.from('memos_backup')
      .select('id, owner_id, title, body, content_sha256').eq('id', id).eq('owner_id', userId).maybeSingle();
    if (readError) { dbFailed(response, 'MEMO_BACKUP_READ_FAILED', readError); return; }
    if (!backup || backup.id !== id || backup.owner_id !== userId) {
      console.warn('MEMO_RESTORE_DENIED', 'not_found');
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (typeof backup.title !== 'string' || typeof backup.body !== 'string'
        || memoContentSha256(backup.title, backup.body) !== backup.content_sha256) {
      console.error('MEMO_BACKUP_UNVERIFIED');
      response.status(409).json({ error: 'BACKUP_UNVERIFIED' });
      return;
    }

    // 살아 있는 메모가 본인 것이면 고치고, 지워졌으면 같은 ID로 다시 만듭니다. 소유자는 바꾸지 않습니다.
    const { data: updated, error: updateError } = await supabase.from('memos')
      .update({ title: backup.title, body: backup.body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', userId).select('id');
    if (updateError) { dbFailed(response, 'MEMO_RESTORE_FAILED', updateError); return; }
    if (!updated?.length) {
      const { error: insertError } = await supabase.from('memos')
        .insert({ id, owner_id: userId, title: backup.title, body: backup.body });
      if (insertError?.code === '23505') {
        // 같은 ID의 살아 있는 행이 본인 것이 아니면 건드리지 않고 같은 404로 답합니다.
        console.warn('MEMO_RESTORE_DENIED', 'not_owner');
        response.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      if (insertError) { dbFailed(response, 'MEMO_RESTORE_FAILED', insertError); return; }
    }

    const { data: live, error: verifyError } = await supabase.from('memos')
      .select('id, owner_id, title, body').eq('id', id).eq('owner_id', userId).maybeSingle();
    if (verifyError) { dbFailed(response, 'MEMO_RESTORE_VERIFY_FAILED', verifyError); return; }
    if (!live || live.id !== id || live.owner_id !== userId
        || memoContentSha256(live.title, live.body) !== backup.content_sha256) {
      console.error('MEMO_RESTORE_VERIFY_FAILED', 'mismatch');
      response.status(500).json({ error: 'RESTORE_VERIFY_FAILED' });
      return;
    }
    console.info('MEMO_RESTORED');
    response.status(200).json({ id, restored: true, contentSha256: backup.content_sha256 });
  } catch {
    console.error('MEMO_RESTORE_REQUEST_FAILED');
    response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}
