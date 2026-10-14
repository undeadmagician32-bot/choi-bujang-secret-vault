import { authorize, methodNotAllowed } from '../../src/memo-api.mjs';
import { restoreMemo, supabaseStore } from '../../src/memo-restore.mjs';
import { markResource } from '../../src/resources.mjs';

// POST /api/memo-restore/:id
// 비공개 사본(memo_backups)에서 로그인한 본인의 메모 한 건만 되살립니다. 본문: 선택 항목 { contentHash }.
// 응답은 200 { id, contentHash } 뿐이고 메모 내용은 싣지 않습니다. 대조 규칙은 src/memo-restore.mjs에 있습니다.
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    methodNotAllowed(response, 'POST');
    return;
  }
  markResource(response, 'POST /api/memo-restore/:id');
  const session = await authorize(request, response);
  if (!session) return;
  const id = typeof request.query?.id === 'string' ? request.query.id : '';
  let input = request.body;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = null; } }
  if (input !== undefined && input !== null && (typeof input !== 'object' || Array.isArray(input))) {
    response.status(400).json({ error: 'INVALID_BODY' });
    return;
  }
  try {
    const result = await restoreMemo({ userId: session.userId, id, input: input ?? {},
      store: supabaseStore(session.supabase) });
    response.status(result.status).json(result.body);
  } catch (error) {
    // 오류 문구에는 요청 정보가 섞일 수 있어 고정 코드와 오류 코드만 남깁니다.
    console.error('MEMO_RESTORE_FAILED', error?.code ?? 'unknown');
    response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}
