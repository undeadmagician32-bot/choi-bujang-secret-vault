// 8단계: 자료 종류마다 서버가 정한 자원 ID입니다.
// 서버 함수가 처리하는 경로 모양("METHOD /경로")만 보고 정하며, 브라우저가 보낸 값은 읽지 않습니다.
// 표에 없는 경로는 null입니다. 비슷한 자원으로 추측해 채우지 않습니다.
export const RESOURCE_IDS = Object.freeze({
  memo: 'vault.memo', // 내 자료실 메모: 본인 소유 행만 다룹니다(/api/memos).
  notice: 'class.notice', // 강사 공지: 로그인한 모두가 같은 목록을 읽기만 합니다(/api/notes, archive_notes).
});

const ROUTE_RESOURCES = new Map([
  ['GET /api/memos', RESOURCE_IDS.memo],
  ['POST /api/memos', RESOURCE_IDS.memo],
  ['GET /api/memos/:id', RESOURCE_IDS.memo],
  ['PUT /api/memos/:id', RESOURCE_IDS.memo],
  ['DELETE /api/memos/:id', RESOURCE_IDS.memo],
  ['POST /api/memos/restore/:id', RESOURCE_IDS.memo], // 10단계: 비공개 사본에서 본인 메모 한 건 복원
  ['GET /api/notes', RESOURCE_IDS.notice],
]);

export const resourceIdFor = (route) => ROUTE_RESOURCES.get(route) ?? null;

// 응답 머리글 X-Resource-Id로 이번 요청의 자원 ID를 알립니다. 자료 본문이나 사용자 정보는 담지 않습니다.
export function markResource(response, route) {
  const resourceId = resourceIdFor(route);
  if (resourceId) response.setHeader('X-Resource-Id', resourceId);
  return resourceId;
}
