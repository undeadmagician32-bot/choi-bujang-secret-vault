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

// ---------- 14단계: 업무 앱 접근 요청 결과 표시 ----------

// 판정 값을 한국어와 원래 값으로 함께 보여 준다. 허용만 'allow' 모양을 쓰고, 나머지는 허용처럼 보이지 않게 한다.
const DECISION_LABEL = {
  allow: { text: '허용', note: '정책상 접근이 허용되었습니다. 실제 앱 접속 성공을 보장하지는 않습니다.' },
  deny: { text: '거부', note: '정책상 접근이 거부되었습니다.' },
  challenge: { text: '추가 확인 필요', note: '접근하려면 추가 인증 또는 확인이 필요합니다. 이 앱이 확인 절차를 대신 수행하지 않습니다.' },
  unknown: { text: '확인 불가', note: '판정을 확인할 수 없습니다. 접근이 허용되지 않은 것으로 보아야 합니다.' },
};

// 판정 시각은 내 PC 시간대로 읽기 쉽게 바꾸고 서버가 보낸 원래 값도 함께 적는다.
function formatTime(value) {
  if (!value) return '확인 불가';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return `확인 불가 (${String(value)})`;
  return `${time.toLocaleString('ko-KR')} (${value})`;
}

function decisionModeNotice(mode) {
  if (!Object.hasOwn(MODE_NOTICE, mode)) return null;
  const notice = node('p', MODE_NOTICE[mode], 'state state-empty');
  notice.setAttribute('role', 'status');
  notice.dataset.mode = mode;
  return notice;
}

function renderDecisionView({ status, mode, data, error, appId } = {}) {
  const root = node('div', undefined, 'student-decision');
  const notice = decisionModeNotice(mode);
  if (notice) root.append(notice);
  const appText = `대상 앱: ${appId ?? '선택 안 함'}`;

  if (status === 'idle') {
    root.dataset.state = 'idle';
    root.append(node('p', '요청 전: 앱을 골라 접속을 요청하세요.', 'state state-empty'));
    return root;
  }
  if (status === 'loading') {
    root.dataset.state = 'loading';
    root.append(node('p', appText), node('p', '판정 확인 중', 'state state-loading'));
    return root;
  }
  if (status === 'error') {
    // 요청 실패는 서버의 거부 판정과 다르다. 허용으로도, 거부로도 보이지 않게 따로 표시한다.
    root.dataset.state = 'error';
    const message = error && error.message ? error.message : '서버 메시지 없음';
    const box = node('p', `요청 실패: ${message}`, 'state state-error');
    box.setAttribute('role', 'alert');
    root.append(node('p', appText), box, node('p', '이것은 접근 거부 판정이 아닙니다. 판정을 받지 못했으므로 접근이 허용되지 않은 상태로 보아야 합니다.'));
    return root;
  }
  if (status !== 'ok' || !data) {
    root.dataset.state = 'unknown';
    root.append(node('p', appText), node('p', '확인 불가(unknown): 판정을 받지 못했습니다. 허용되지 않음.', 'decision decision-unknown'));
    return root;
  }

  // 목록에 없는 decision은 확인 불가(unknown)로 처리한다.
  const known = Object.hasOwn(DECISION_LABEL, data.decision);
  const code = known ? data.decision : 'unknown';
  const label = DECISION_LABEL[code];
  root.dataset.state = 'ok';
  root.dataset.decision = code;
  root.append(node('p', `대상 앱: ${data.appId ?? appId ?? '확인 불가'}`));
  const result = node('p', `판정: ${label.text}(${code})`, `decision decision-${code}`);
  result.setAttribute('role', 'status');
  root.append(result);
  if (!known) root.append(node('p', `서버가 보낸 판정 값: ${String(data.decision ?? '값 없음')} (목록에 없는 값)`));
  root.append(node('p', label.note));
  const list = node('dl');
  row(list, '판정 이유', node('span', data.reason ? String(data.reason) : '이유 없음'));
  row(list, '판정 시각', node('span', formatTime(data.checkedAt)));
  root.append(list);
  return root;
}

// ---------- 15단계: 접속 기록·XDR 경보 목록과 상세 보기 ----------

const EVENT_KIND = { access: '접속 기록', xdr: 'XDR 경보' };
const ACCESS_STATE = { allowed: '허용됨', denied: '거부됨', unknown: '확인 불가' };
// 앱 ID가 없는 기록을 고르는 필터 값. 실제 appId 값과 겹치지 않도록 빈 문자열을 쓴다.
const NO_APP = '';

// 필터와 상세 선택은 이 파일 안에만 둔다. 서버 데이터는 바꾸지 않는다.
const eventView = { filters: { kind: 'all', appId: 'all', access: 'all' }, selectedId: null };

function stateText(table, value) {
  const known = Object.hasOwn(table, value);
  const text = known ? (typeof table[value] === 'string' ? table[value] : table[value].text) : '확인 불가';
  return `${text}(${known ? value : `unknown, 받은 값: ${String(value ?? '값 없음')}`})`;
}

function appText(appId) {
  return appId == null || appId === '' ? '앱 확인 불가(appId 없음)' : String(appId);
}

function eventFilterSelect(id, labelText, key, values, describe, onChange) {
  const wrap = node('div', undefined, 'student-event-filter');
  const label = node('label', labelText);
  label.htmlFor = id;
  const select = node('select');
  select.id = id;
  select.name = key;
  const all = node('option', '전체');
  all.value = 'all';
  select.append(all);
  for (const value of values) {
    const option = node('option', describe(value));
    option.value = value;
    select.append(option);
  }
  select.value = eventView.filters[key];
  select.addEventListener('change', () => { eventView.filters[key] = select.value; onChange(); });
  wrap.append(label, select);
  return wrap;
}

function eventDetail(event) {
  const detail = node('section', undefined, 'student-event-detail');
  detail.dataset.studentEventDetail = event.id;
  detail.setAttribute('aria-label', `${event.id} 상세`);
  detail.append(node('h4', `${event.id} 상세`));
  const info = node('dl');
  row(info, '사건 ID', node('span', String(event.id)));
  row(info, '앱', node('span', appText(event.appId)));
  row(info, '접속 상태(access)', node('span', stateText(ACCESS_STATE, event.state && event.state.access)));
  row(info, '세션 상태(session)', node('span', stateText(SESSION_STATUS, event.state && event.state.session)));
  row(info, '기기 상태(device)', node('span', stateText(DEVICE_STATUS, event.state && event.state.device)));
  detail.append(info);
  for (const [title, rows] of [['근거(evidence)', event.evidence], ['규칙(rules)', event.rules]]) {
    detail.append(node('h5', title));
    const items = Array.isArray(rows) ? rows : [];
    if (items.length === 0) { detail.append(node('p', `${title}: 없음`)); continue; }
    const list = node('ul');
    for (const item of items) list.append(node('li', `${item.id}: ${item.text}`));
    detail.append(list);
  }
  // 조치 버튼은 만들지 않는다. 연결되지 않은 조치 안내는 16단계에서 다룬다.
  return detail;
}

function renderEventsView({ status, mode, data, error } = {}) {
  const root = node('div', undefined, 'student-events');
  const notice = decisionModeNotice(mode);
  if (notice) root.append(notice);

  // ok가 아니면 이전 목록과 상세 선택을 모두 버린다. 다시 불러오기는 항상 loading을 거친다.
  if (status !== 'ok') eventView.selectedId = null;
  if (status === 'loading') {
    root.append(node('p', '기록을 불러오는 중', 'state state-loading'));
    return root;
  }
  if (status === 'error') {
    const message = error && error.message ? error.message : '서버 메시지 없음';
    const box = node('p', `기록을 불러오지 못했습니다: ${message}`, 'state state-error');
    box.setAttribute('role', 'alert');
    root.append(box);
    if (error && error.code === 'CONTRACT_MISMATCH') {
      root.append(node('p', '확인 불가(CONTRACT_MISMATCH): 받은 기록의 형식을 확인할 수 없어 이전 목록을 표시하지 않습니다.'));
    }
    return root;
  }
  if (status !== 'ok' || !Array.isArray(data)) {
    root.append(node('p', '확인 불가: 기록 상태를 확인할 수 없습니다.', 'state state-empty'));
    return root;
  }
  if (data.length === 0) {
    root.append(node('p', '표시할 기록이 없습니다. (조회는 성공했고 받은 기록이 0건입니다)', 'state state-empty'));
    return root;
  }

  // 원본 배열을 바꾸지 않도록 복사한 뒤 at 기준 최신순으로 정렬한다.
  const events = [...data].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const unique = (pick) => [...new Set(events.map(pick))];
  const kinds = unique((e) => e.kind);
  const apps = unique((e) => (e.appId == null ? NO_APP : e.appId));
  const accesses = unique((e) => e.state && e.state.access);
  // 새 자료에 없는 필터 값은 전체로 되돌린다.
  for (const [key, values] of [['kind', kinds], ['appId', apps], ['access', accesses]]) {
    if (eventView.filters[key] !== 'all' && !values.includes(eventView.filters[key])) eventView.filters[key] = 'all';
  }
  if (!events.some((e) => e.id === eventView.selectedId)) eventView.selectedId = null;

  const filters = node('div', undefined, 'student-event-filters');
  const count = node('p');
  count.setAttribute('role', 'status');
  const list = node('ul', undefined, 'student-event-list');
  const detailSlot = node('div');

  const draw = () => {
    const { kind, appId, access } = eventView.filters;
    const shown = events.filter((e) => (kind === 'all' || e.kind === kind)
      && (appId === 'all' || (e.appId == null ? NO_APP : e.appId) === appId)
      && (access === 'all' || (e.state && e.state.access) === access));
    count.textContent = `받은 기록 ${events.length}건 중 ${shown.length}건 표시 (최신순)`;
    list.replaceChildren();
    for (const event of shown) {
      const item = node('li');
      item.dataset.studentEventId = event.id;
      const kindText = Object.hasOwn(EVENT_KIND, event.kind) ? `${EVENT_KIND[event.kind]}(${event.kind})` : `확인 불가(${String(event.kind)})`;
      item.append(node('p', `${event.id} · ${formatTime(event.at)} · ${kindText} · 앱: ${appText(event.appId)}`));
      item.append(node('p', String(event.summary ?? '')));
      const button = node('button', `${event.id} 상세`);
      button.type = 'button';
      button.setAttribute('aria-label', `${event.id} 상세`);
      button.setAttribute('aria-expanded', String(eventView.selectedId === event.id));
      button.addEventListener('click', () => {
        eventView.selectedId = eventView.selectedId === event.id ? null : event.id;
        draw();
      });
      item.append(button);
      list.append(item);
    }
    if (shown.length === 0) list.append(node('li', '필터 조건에 맞는 기록이 없습니다.'));
    detailSlot.replaceChildren();
    const selected = shown.find((e) => e.id === eventView.selectedId);
    if (selected) detailSlot.append(eventDetail(selected));
  };

  filters.append(
    eventFilterSelect('student-filter-kind', '기록 종류', 'kind', kinds, (v) => (Object.hasOwn(EVENT_KIND, v) ? `${EVENT_KIND[v]}(${v})` : String(v)), draw),
    eventFilterSelect('student-filter-app', '업무 앱', 'appId', apps, appText, draw),
    eventFilterSelect('student-filter-access', '접속 상태', 'access', accesses, (v) => stateText(ACCESS_STATE, v), draw),
  );
  root.append(filters, count, list, detailSlot);
  draw();
  return root;
}

export function createStudentView() {
  return {
    renderIdentity(input) { return renderIdentityView(input); },
    renderDecision(input) { return renderDecisionView(input); },
    renderEvents(input) { return renderEventsView(input); },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
