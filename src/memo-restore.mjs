import { createHash } from 'node:crypto';
import { isUuid } from './memo-api.mjs';

// 10단계 제작 3: 비공개 가상 메모 사본(public.memo_backups)에서 지정한 메모 한 건만 되살립니다.
// 서버가 토큰으로 확인한 userId만 믿습니다. 요청의 owner_id·본문은 읽지 않고, 읽는 것은 경로의 id와 선택 항목 contentHash뿐입니다.
// 이 모듈은 DB를 직접 모르고 store 인터페이스만 씁니다(시험에서는 메모리 store, 배포에서는 Supabase store).

const HASH = /^[0-9a-f]{64}$/u;

// 내용 해시: 제목과 본문만 고정된 순서로 묶어 SHA-256. id·소유자는 따로 대조하므로 해시에 넣지 않습니다.
export const contentHashOf = (title, body) => createHash('sha256').update(JSON.stringify({ title, body })).digest('hex');

// 결과: { status, body, audit }. 응답 본문에는 메모 제목·본문을 절대 싣지 않습니다.
// 남의 사본과 없는 사본은 같은 404로 답해 메모가 있는지 알려 주지 않습니다.
export async function restoreMemo({ userId, id, input, store, now = () => new Date() }) {
  if (!isUuid(id)) return { status: 400, body: { error: 'INVALID_ID' } };
  const wantHash = input?.contentHash;
  if (wantHash !== undefined && (typeof wantHash !== 'string' || !HASH.test(wantHash))) {
    return { status: 400, body: { error: 'INVALID_HASH' } };
  }
  const memoId = id.toLowerCase();
  const audit = async (outcome, contentHash) => store.insertAudit({
    at: now().toISOString(), memo_id: memoId, owner_id: userId, content_hash: contentHash ?? null, outcome });

  const backup = await store.getBackup(memoId);
  // 1. ID 대조: 사본의 memo_id가 요청한 id와 같아야 합니다.
  // 2. 소유자 대조: 사본의 owner_id가 서버가 확인한 사용자와 같아야 합니다.
  if (!backup || backup.memo_id !== memoId || backup.owner_id !== userId) {
    await audit('denied_not_found').catch(() => {});
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }
  // 3. 내용 해시 대조: 사본 내용을 다시 계산한 값이 사본에 적힌 해시와 같아야 하고, 요청이 해시를 주었다면 그것과도 같아야 합니다.
  const actualHash = contentHashOf(backup.title, backup.body);
  if (actualHash !== backup.content_hash) {
    await audit('denied_backup_corrupt', actualHash).catch(() => {});
    return { status: 409, body: { error: 'BACKUP_INTEGRITY_FAILED' } };
  }
  if (wantHash !== undefined && wantHash !== actualHash) {
    await audit('denied_hash_mismatch', actualHash).catch(() => {});
    return { status: 409, body: { error: 'HASH_MISMATCH' } };
  }
  // 현재 메모가 다른 사람 소유로 남아 있으면 덮어쓰지 않습니다(존재 여부도 알리지 않음).
  const current = await store.getMemo(memoId);
  if (current && current.owner_id !== userId) {
    await audit('denied_not_found').catch(() => {});
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }
  // 감사 기록은 쓰기 전에 남깁니다. 남기지 못하면 복원하지 않습니다.
  await audit('restoring', actualHash);
  try {
    if (current) await store.updateMemo({ id: memoId, owner_id: userId, title: backup.title, body: backup.body,
      updated_at: now().toISOString() });
    else await store.insertMemo({ id: memoId, owner_id: userId, title: backup.title, body: backup.body });
  } catch (error) {
    await audit('failed', actualHash).catch(() => {});
    if (error?.code === '23505') return { status: 409, body: { error: 'ID_EXISTS' } };
    throw error;
  }
  await audit('restored', actualHash).catch(() => console.error('RESTORE_AUDIT_FAILED'));
  return { status: 200, body: { id: memoId, contentHash: actualHash } };
}

// Supabase용 store. 다른 메모 행에는 손대지 않고, 감사 표에는 덧붙이기(insert)만 합니다.
export function supabaseStore(supabase) {
  const must = ({ data, error }) => { if (error) throw error; return data; };
  return {
    getBackup: async (id) => must(await supabase.from('memo_backups')
      .select('memo_id, owner_id, title, body, content_hash').eq('memo_id', id).maybeSingle()),
    getMemo: async (id) => must(await supabase.from('memos').select('id, owner_id').eq('id', id).maybeSingle()),
    insertMemo: async (row) => must(await supabase.from('memos').insert(row)),
    updateMemo: async ({ id, owner_id, title, body, updated_at }) => must(await supabase.from('memos')
      .update({ title, body, updated_at }).eq('id', id).eq('owner_id', owner_id)),
    insertAudit: async (row) => must(await supabase.from('memo_restore_audit').insert(row)),
  };
}
