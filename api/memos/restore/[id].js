import { authorize, dbFailed, isUuid, memoContentSha256, methodNotAllowed } from '../../../src/memo-api.mjs';
import { markResource } from '../../../src/resources.mjs';

// POST /api/memos/restore/:id → 200 { id, restored: true, contentSha256, contentHash }
// 10단계: 비공개 사본(memos_backup)에서 로그인한 본인의 메모 한 건만 되살립니다. 본문은 읽지 않습니다.
// 처리 순서: 로그인(401) → ID 형식(400) → 사본 읽기(없으면 404) → 사본 해시 다시 계산(다르면 409, 아무것도 쓰지 않음)
// → 사본 주인 = 요청자(아니면 404) → 그 한 건만 되돌리기(지워졌으면 같은 ID로 다시 만들기)
// → 다시 읽어 ID·주인·해시 대조(다르면 500) → 감사 기록 덧붙이기 → 200.
// 사본의 주인은 쿼리에서 로그인으로 확인된 사용자 ID와 함께 거릅니다. 남의 메모와 사본 없는 ID는 같은 404입니다.
// contentSha256과 contentHash는 같은 값입니다(수업 안내의 이름을 함께 씀).
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    methodNotAllowed(response, 'POST');
    return;
  }
  markResource(response, 'POST /api/memos/restore/:id');
  const session = await authorize(request, response);
  if (!session) return;
  const { userId, supabase } = session;

  const id = typeof request.query?.id === 'string' ? request.query.id.toLowerCase() : '';
  if (!isUuid(id)) { response.status(400).json({ error: 'INVALID_ID' }); return; }

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

    // 감사 기록은 덧붙이기만 합니다. 제목·본문은 적지 않고 ID·소유자·해시만 적습니다.
    const { error: auditError } = await supabase.from('memos_restore_audit')
      .insert({ memo_id: id, owner_id: userId, content_sha256: backup.content_sha256, outcome: 'restored' });
    if (auditError) {
      console.error('MEMO_RESTORE_AUDIT_FAILED', auditError.code ?? 'unknown');
      response.status(500).json({ error: 'AUDIT_FAILED' });
      return;
    }
    console.info('MEMO_RESTORED');
    response.status(200).json({ id, restored: true, contentSha256: backup.content_sha256, contentHash: backup.content_sha256 });
  } catch {
    console.error('MEMO_RESTORE_REQUEST_FAILED');
    response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}
