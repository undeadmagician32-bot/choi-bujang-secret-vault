// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 규칙에 맞지 않는 요청은 기본 응답으로 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered']);

const response = (request, decision, reasonCode, ruleId) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision,
  reasonCode,
  ruleIds: [ruleId],
});

export async function decide(request) {
  // 6단계 device_registered: 엔진이 등록됐다고 확인한 기기(true)만 통과. 미등록·값 없음은 거부.
  if (request.deviceRegistered !== true) {
    return response(request, 'deny', 'device_not_registered', 'device_registered');
  }
  // 등록 기기의 내 자료실 읽기(GET)만 허용.
  if (request.method === 'GET') {
    return response(request, 'allow', 'approved', 'device_registered');
  }
  return response(request, 'deny', 'starter_not_ready', RULE_IDS[0]);
}
