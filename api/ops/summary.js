import { authorize, methodNotAllowed } from '../../src/memo-api.mjs';
import { buildOpsSummary, opsLogRecord, supabaseOpsStore } from '../../src/ops-summary.mjs';

// GET /api/ops/summary
// 탈환 작전실 요약: 판정기 규칙 목록, 탐지 상태, 기기 회수 상태, 복구 버전. 로그인과 기기 승인이 필요합니다.
// 서버가 토큰으로 확인한 본인의 행만 세고, 메모 본문·식별자는 싣지 않습니다. 쿼리·본문은 읽지 않습니다.
// 서버 기록(OPS_SUMMARY)에는 같은 요약에서 만든 수치만 남기며, recordId로 화면과 맞춰 봅니다.
export default async function handler(request, response) {
  if (request.method !== 'GET') {
    methodNotAllowed(response, 'GET');
    return;
  }
  const session = await authorize(request, response);
  if (!session) return;
  const summary = await buildOpsSummary({ userId: session.userId, store: supabaseOpsStore(session.supabase) });
  console.info('OPS_SUMMARY', JSON.stringify(opsLogRecord(summary)));
  response.status(200).json(summary);
}
