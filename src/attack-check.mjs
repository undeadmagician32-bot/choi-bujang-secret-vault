// 제출 묶음(npm run bundle)의 공격 점검 기록입니다. 심판의 규칙에 따라, 이 묶음은 요청을 보내지 않습니다.
// 요청을 보내지 않은 점검은 observed를 not_run으로 적고, 통과·거부·허용 같은 결과를 지어내지 않습니다.
// 배포 주소로 실제 요청을 보낸 결과(요청 ID·확인 시각 포함)는 `npm run matrix:run`이 만드는 표(artifacts/matrix.md,
// 커밋하지 않음)에 따로 있습니다. 이 모듈은 네트워크·토큰·키·메모 본문을 다루지 않습니다.
// 심판의 판정이 아닙니다.
const NOT_RUN = 'not_run';
const SUPPORTED_STEPS = [5, 6, 7, 8, 9, 10, 11, 12];

// 11단계까지 이 묶음이 직접 보내던 점검 16건의 이름과 기대 결과입니다(보내지 않아도 무엇을 점검하는지 남깁니다).
const CHECKS = [
  ['anonymous_data_json', '비로그인 /data.json에서 가상 메모 확인 표시가 보이지 않음'],
  ['home_security_header', '첫 화면 응답에 X-Content-Type-Options: nosniff(또는 CSP) 머리글이 있음'],
  ['home_code_has_no_key', '첫 화면 코드에 Supabase 공개 키(sb_publishable_·anon 키)가 없음'],
  ['anonymous_notes_read', '로그인 없이 가상 메모 API를 읽으면 401'],
  ['anonymous_memo_list', '로그인 없이 메모 목록을 읽으면 401'],
  ['anonymous_memo_create', '로그인 없이 메모를 추가하면 401'],
  ['anonymous_memo_update', '로그인 없이 메모를 고치면 401'],
  ['anonymous_memo_delete', '로그인 없이 메모를 지우면 401'],
  ['anonymous_memo_read_known_id', '로그인 없이 알려진 메모 id로 읽으면 401'],
  ['anonymous_memo_restore', '로그인 없이 사본에서 메모를 복원하면 401'],
  ['anonymous_device_status', '로그인 없이 기기 승인 상태를 조회하면 401'],
  ['anonymous_device_request', '로그인 없이 기기 승인을 요청하면 401'],
  ['anonymous_memo_owner_change', '로그인 없이 owner_id를 넣어 고치면 401'],
  ['forged_token_notes', '위조 토큰으로 가상 메모 API를 읽으면 401'],
  ['forged_token_memo_list', '위조 토큰으로 메모 목록을 읽으면 401'],
  ['direct_original_api_anon', '공개 키로 원본 자료 API에 직접 요청하면 401 또는 403'],
];

export async function runAttackChecks(config) {
  if (!SUPPORTED_STEPS.includes(config?.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  return CHECKS.map(([attackId, expected]) => ({ attackId, expected, observed: NOT_RUN }));
}
