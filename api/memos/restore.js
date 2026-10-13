import { authorize, dbFailed, isUuid, memoContentSha256, methodNotAllowed, plainObject, TITLE_MAX, BODY_MAX }
  from '../../src/memo-api.mjs';
import { markResource } from '../../src/resources.mjs';

// POST /api/memos/restore  { id } → 200 { id, restored: true, contentSha256 }
// 10단계: 비공개 사본 테이블 memos_backup(서버 전용 키만 접근, docs/MEMOS_BACKUP.sql)에서
// 로그인한 본인의 메모 한 건만 되살립니다. 사본의 ID·소유자·내용 해시를 대조한 뒤 쓰고,
// 쓴 뒤 다시 읽어 세 값이 사본과 같은지 확인합니다. 다른 메모와 사본·기록 테이블은 건드리지 않습니다.
// 남의 메모와 사본이 없는 메모는 같은 404로 답해 존재 여부를 알려 주지 않습니다.
const sameMemo = (row, backup) => row && row.id === backup.id && row.owner_id === backup.owner_id
  && memoContentSha256(row.title, row.body) === backup.content_sha256;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    methodNotAllowed(response, 'POST');
    return;
  }
  markResource(response, 'POST /api/memos/restore');
  const session = await authorize(request, response);
  if (!session) return;
  const { userId, supabase } = session;

  // 본문은 { id } 하나만 받습니다. 소유자·내용·해시는 요청에서 받지 않습니다.
  const input = plainObject(request.body);
  if (!input || Object.keys(input).join(',') !== 'id' || !isUuid(input.id)) {
    response.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const id = input.id.toLowerCase();

  try {
    const { data: backup, error: backupError } = await supabase.from('memos_backup')
      .select('id, owner_id, title, body, content_sha256')
      .eq('id', id).eq('owner_id', userId).maybeSingle();
    if (backupError) { dbFailed(response, 'MEMO_RESTORE_BACKUP_FAILED', backupError); return; }
    if (!backup) {
      console.warn('MEMO_RESTORE_DENIED', 'no_backup');
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    // 사본 자체 검증: 요청한 ID·확인된 사용자와 같고, 저장된 해시가 내용과 맞고, 메모 제한 안이어야 합니다.
    if (backup.id !== id || backup.owner_id !== userId || typeof backup.title !== 'string'
        || typeof backup.body !== 'string' || !backup.title.trim() || backup.title.length > TITLE_MAX
        || backup.body.length > BODY_MAX || !sameMemo(backup, backup)) {
      console.warn('MEMO_RESTORE_DENIED', 'backup_unverified');
      response.status(409).json({ error: 'BACKUP_UNVERIFIED' });
      return;
    }

    // 본인 행이 있으면 그 행만 고치고, 없으면 같은 ID로 다시 만듭니다. 남의 행은 고치지 않습니다.
    const { data: updated, error: updateError } = await supabase.from('memos')
      .update({ title: backup.title, body: backup.body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', userId).select('id');
    if (updateError) { dbFailed(response, 'MEMO_RESTORE_WRITE_FAILED', updateError); return; }
    if (!updated?.length) {
      const { error: insertError } = await supabase.from('memos')
        .insert({ id, owner_id: userId, title: backup.title, body: backup.body });
      if (insertError?.code === '23505') {
        console.warn('MEMO_RESTORE_DENIED', 'not_owner');
        response.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      if (insertError) { dbFailed(response, 'MEMO_RESTORE_WRITE_FAILED', insertError); return; }
    }

    const { data: current, error: readError } = await supabase.from('memos')
      .select('id, owner_id, title, body').eq('id', id).eq('owner_id', userId).maybeSingle();
    if (readError) { dbFailed(response, 'MEMO_RESTORE_CHECK_FAILED', readError); return; }
    if (!sameMemo(current, backup)) {
      console.error('MEMO_RESTORE_MISMATCH');
      response.status(500).json({ error: 'RESTORE_MISMATCH' });
      return;
    }
    // 기록에는 고정 문구만 남깁니다(사용자 ID·메모 ID·본문 없음).
    console.info('MEMO_RESTORED');
    response.status(200).json({ id, restored: true, contentSha256: backup.content_sha256 });
  } catch {
    console.error('MEMO_RESTORE_FAILED');
    response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}
