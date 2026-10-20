// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.

// ---------- 13단계: 로그인 사용자·기기·세션 표시 ----------

// 기기 보안 상태와 세션 상태를 한국어로 바꾼다. 정상이 아닌 값은 tone 'error'로 표시한다.
const DEVICE_STATUS = {
  compliant: { text: '보안 기준 충족', tone: 'ok' },
  noncompliant: { text: '보안 기준 미충족', tone: 'error' },
  unknown: { text: '확인 불가', tone: 'empty' },
};
const SESSION_STATUS = {
  active: { text: '활성', tone: 'ok' },
  expired: { text: '만료', tone: 'error' },
  revoked: { text: '철회됨', tone: 'error' },
  unknown: { text: '확인 불가', tone: 'empty' },
};
// 실제 연결(connected)이 아닌 모드는 화면에 함께 알린다.
const MODE_NOTICE = {
  demo: '예제 자료: 실제 회사 시스템의 값이 아닙니다.',
  disconnected: '연결 없음: 실제 회사 시스템에 연결되어 있지 않습니다.',
  unknown: '확인 불가: 연결 상태를 확인할 수 없습니다.',
};

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

// 상태 값을 색상과 글자로 함께 보여 준다. 목록에 없는 값은 확인 불가로 처리한다.
function statusBadge(table, value) {
  const known = Object.hasOwn(table, value) ? table[value] : null;
  const info = known || { text: '확인 불가', tone: 'empty' };
  const prefix = info.tone === 'error' ? '주의: ' : '';
  const badge = node('span', `${prefix}${info.text} (${String(value ?? '값 없음')})`, `state state-${info.tone}`);
  badge.dataset.status = known ? value : 'unknown';
  return badge;
}

function row(list, label, ...values) {
  list.append(node('dt', label));
  const dd = node('dd');
  dd.append(...values);
  list.append(dd);
}

// loading·error·그 밖의 상태를 공통으로 처리한다. ok이면 null을 돌려준다.
function resourceProblem(resource, what) {
  const status = resource && resource.status;
  if (status === 'loading') return node('p', `${what}: 불러오는 중`, 'state state-loading');
  if (status === 'error') {
    const message = resource.error && resource.error.message ? resource.error.message : '서버 메시지 없음';
    const box = node('p', `${what} 연결 실패: ${message}`, 'state state-error');
    box.setAttribute('role', 'alert');
    return box;
  }
  if (status !== 'ok') return node('p', `${what}: 확인 불가`, 'state state-empty');
  return null;
}

function renderMe(me) {
  const section = node('section');
  section.dataset.part = 'me';
  section.append(node('h4', '현재 로그인 정보'));
  const problem = resourceProblem(me, '현재 로그인 정보');
  // 오류·불러오는 중에는 사용자 값을 그리지 않는다. 매번 새 요소를 만들므로 이전 값이 남지 않는다.
  if (problem) { section.append(problem); return section; }
  const data = me.data || {};
  const user = data.user || {};
  const device = data.device || {};
  const session = data.session || {};
  const list = node('dl');
  row(list, '사용자', node('span', `${user.label ?? '확인 불가'} (ID: ${user.id ?? '확인 불가'})`));
  row(list, '현재 기기', node('span', `${device.label ?? '확인 불가'} (ID: ${device.id ?? '확인 불가'}) `), statusBadge(DEVICE_STATUS, device.status));
  row(list, '현재 세션', node('span', `ID: ${session.id ?? '확인 불가'} `), statusBadge(SESSION_STATUS, session.status));
  section.append(list);
  return section;
}

function renderList(resource, title, describe) {
  const section = node('section');
  section.append(node('h4', title));
  const problem = resourceProblem(resource, title);
  if (problem) { section.append(problem); return section; }
  const items = Array.isArray(resource.data) ? resource.data : [];
  if (items.length === 0) { section.append(node('p', `${title}: 항목 없음`, 'state state-empty')); return section; }
  const list = node('ul');
  for (const item of items) {
    const li = node('li');
    li.append(...describe(item || {}));
    list.append(li);
  }
  section.append(list);
  return section;
}

function renderIdentityView({ me, devices, sessions } = {}) {
  const root = node('div', undefined, 'student-identity');
  // loading·error 상태에서도 demo·disconnected·unknown 모드 안내를 함께 보여 준다.
  const modes = new Set([me, devices, sessions].map((resource) => resource && resource.mode));
  for (const mode of ['demo', 'disconnected', 'unknown']) {
    if (!modes.has(mode)) continue;
    const notice = node('p', MODE_NOTICE[mode], 'state state-empty');
    notice.setAttribute('role', 'status');
    notice.dataset.mode = mode;
    root.append(notice);
  }
  root.append(renderMe(me));
  root.append(renderList(devices, '내 기기 목록', (device) => [
    node('span', `${device.label ?? '확인 불가'} (ID: ${device.id ?? '확인 불가'}) `),
    statusBadge(DEVICE_STATUS, device.status),
  ]));
  root.append(renderList(sessions, '내 로그인 세션 목록', (session) => [
    node('span', `ID: ${session.id ?? '확인 불가'} `),
    statusBadge(SESSION_STATUS, session.status),
  ]));
  return root;
}

export function createStudentView() {
  return {
    renderIdentity(input) { return renderIdentityView(input); },
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
