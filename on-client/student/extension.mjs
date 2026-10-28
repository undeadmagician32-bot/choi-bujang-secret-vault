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
  // 16단계: 실행 연결이 없는 조치가 넘어온 경우에만 비활성 안내 버튼을 둔다. 목록이 비어 있으면 아무것도 만들지 않는다.
  const actions = Array.isArray(event.supportedActions) ? event.supportedActions : [];
  if (actions.length > 0) {
    detail.append(node('h5', '조치'));
    detail.append(node('p', '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중이며, 아래 버튼은 어떤 요청도 보내지 않습니다.'));
    for (const action of actions) {
      const button = node('button', `${action} 미지원`);
      button.type = 'button';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.dataset.unsupportedAction = String(action);
      detail.append(button);
    }
  }
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

// ---------- 16단계: 알림·빈 상태·오류·진단 정보 정리 ----------

const RESOURCE_NAME = {
  me: '로그인 정보', apps: '업무 앱', events: '보안 기록', devices: '기기', sessions: '세션',
  access: '접속 판정', diagnostics: '도움정보', vulnerabilities: '설치 패키지 조회',
};
const RETRY_HINT = '다시 시도는 위쪽 「다시 불러오기」 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.';
// 진단 결과에서 화면에 보여 주고 복사할 값은 이 여섯 개뿐이다.
const DIAGNOSTIC_FIELDS = [
  ['requestId', (d) => d.requestId], ['component', (d) => d.component], ['version', (d) => d.version],
  ['checkedAt', (d) => d.checkedAt], ['engine.mode', (d) => d.engine && d.engine.mode], ['engine.code', (d) => d.engine && d.engine.code],
];
// 혹시 값에 열쇠·토큰처럼 보이는 글이 섞이면 가린다.
const SECRET_LIKE = /(bearer\s|sk-|api[_ -]?key|token|password|secret|private key|비밀번호|토큰)/i;
const copyNote = { requestId: null, text: '' };

function resourceName(key) {
  return Object.hasOwn(RESOURCE_NAME, key) ? `${RESOURCE_NAME[key]}(${key})` : String(key ?? '확인 불가');
}

// 불러오는 중·실패·확인 불가를 공통으로 처리한다. ok이면 null을 돌려준다.
function statusProblem(resource, what) {
  const status = resource && resource.status;
  if (status === 'loading') return [node('p', `${what}: 불러오는 중`, 'state state-loading')];
  if (status === 'error') {
    const error = resource.error || {};
    const timeout = error.code === 'TIMEOUT';
    const box = node('p', `${what} 불러오기 실패${timeout ? '(시간 초과)' : ''}: ${error.message || '서버 메시지 없음'}`, 'state state-error');
    box.setAttribute('role', 'alert');
    return [box, node('p', RETRY_HINT)];
  }
  if (status !== 'ok') return [node('p', `${what}: 아직 불러오지 않았습니다.`, 'state state-empty')];
  return null;
}

function statusList(resource, title, emptyText, describe, note) {
  const section = node('section');
  section.append(node('h4', title));
  if (note) section.append(node('p', note));
  const problem = statusProblem(resource, title);
  if (problem) { section.append(...problem); return section; }
  const items = Array.isArray(resource.data) ? resource.data : [];
  if (items.length === 0) { section.append(node('p', emptyText, 'state state-empty')); return section; }
  const list = node('ul');
  for (const item of items) {
    const li = node('li');
    li.append(...describe(item || {}));
    list.append(li);
  }
  section.append(list);
  return section;
}

function safeDiagnosticValue(value) {
  if (value == null) return '확인 불가';
  const text = String(value);
  return SECRET_LIKE.test(text) ? '(비밀값으로 보여 가림)' : text;
}

function diagnosticsSection(diagnostics) {
  const section = node('section');
  section.append(node('h4', '도움정보'));
  section.append(node('p', '도움을 요청할 때 강사에게 전달하도록 아래 값만 복사합니다. 비밀번호·토큰·API 키는 넣지 않으며, 누르기 전에는 복사하거나 전송하지 않습니다.'));
  const ok = diagnostics && diagnostics.status === 'ok' && diagnostics.data;
  let copyText = '';
  if (diagnostics && diagnostics.status === 'idle') {
    section.append(node('p', '도움정보를 아직 불러오지 않았습니다. 화면의 「도움정보 불러오기」를 직접 누르면 여기에 표시됩니다.', 'state state-empty'));
  } else if (!ok) {
    section.append(...(statusProblem(diagnostics, '도움정보') || []));
  } else {
    const list = node('dl');
    const lines = [];
    for (const [name, pick] of DIAGNOSTIC_FIELDS) {
      const value = safeDiagnosticValue(pick(diagnostics.data));
      row(list, name, node('span', value));
      lines.push(`${name}: ${value}`);
    }
    section.append(list);
    // 도움정보는 「다시 불러오기」로 갱신되지 않는다. 언제 확인한 값인지 알린다.
    section.append(node('p', '이 값은 「도움정보 불러오기」를 눌렀던 시각(checkedAt)의 점검 결과입니다. 최신 값이 필요하면 그 버튼을 다시 누르세요.'));
    copyText = lines.join('\n');
    if (copyNote.requestId !== diagnostics.data.requestId) { copyNote.requestId = diagnostics.data.requestId; copyNote.text = ''; }
  }
  const button = node('button', '도움정보 복사');
  button.type = 'button';
  button.disabled = !copyText;
  const note = node('p', ok ? copyNote.text : '');
  note.setAttribute('role', 'status');
  button.addEventListener('click', async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      copyNote.text = '도움정보 여섯 항목을 클립보드에 복사했습니다. 붙여 넣기 전에 내용을 직접 확인하세요.';
    } catch {
      copyNote.text = '자동 복사를 사용할 수 없습니다. 위 값을 직접 선택해 Ctrl+C로 복사하세요.';
    }
    note.textContent = copyNote.text;
  });
  section.append(button, note);
  return section;
}

function renderStatusView({ devices, sessions, notifications, diagnostics, mode } = {}) {
  const root = node('div', undefined, 'student-status');
  const notice = decisionModeNotice(mode);
  if (notice) root.append(notice);

  root.append(statusList(devices, '등록 기기', '등록된 기기가 없습니다.', (device) => [
    node('span', `${device.label ?? '이름 확인 불가'} `), statusBadge(DEVICE_STATUS, device.status),
  ]));
  root.append(statusList(sessions, '현재 세션', '현재 연결 없음: 확인된 세션이 없습니다.', (session) => [
    node('span', `ID: ${session.id ?? '확인 불가'} `), statusBadge(SESSION_STATUS, session.status),
  ], '지금 검증된 연결 1건만 표시합니다. 지난 세션 목록이 아닙니다.'));

  const alerts = node('section');
  alerts.append(node('h4', '알림'));
  const items = Array.isArray(notifications) ? notifications : [];
  if (items.length === 0) {
    alerts.append(node('p', '주의할 알림이 없습니다.', 'state state-ok'));
  } else {
    alerts.append(node('p', `주의할 알림 ${items.length}건`));
    const list = node('ul');
    for (const item of items) {
      const li = node('li', `[${resourceName(item && item.resource)}] ${safeDiagnosticValue(item && item.code)}: ${item && item.message ? item.message : '메시지 없음'}`);
      li.dataset.resource = String(item && item.resource);
      list.append(li);
    }
    alerts.append(list);
  }
  root.append(alerts);
  root.append(diagnosticsSection(diagnostics));
  return root;
}

// ---------- 17단계: 앱 안 AI 연결 점검과 사건 설명 기초 ----------

const AI_RECHECK_HINT = '다시 점검은 「현재 API 연결 점검」 버튼을 직접 누르세요. 자동으로 다시 점검하지 않습니다.';
const AI_AUDIENCE = {
  test: '시험 연결 점검(test)',
  verified: '앱 권한 확인 후 점검(verified)',
};
// 오류 code를 원인별로 나눈다. 목록에 없는 code는 general로 처리한다.
const AI_ERROR_GROUP = {
  ON_AI_PROVISIONING_PENDING: 'pending', AI_REQUEST_UNVERIFIED: 'pending', SUBJECT_SCOPE_UNVERIFIED: 'pending', ON_AI_AUTHORIZATION_CHANGED: 'pending',
  WB_CLCO_AUTH_REQUIRED: 'auth', WB_CLCO_ACCESS_BLOCKED: 'blocked',
  WB_CLCO_COHORT_BUDGET_EXHAUSTED: 'limit', WB_CLCO_LIMIT_REACHED: 'limit',
  WB_CLCO_SESSION_CLOSED: 'hours',
  WB_CLCO_RATE_LIMITED: 'retry', WB_CLCO_TIMEOUT: 'retry', REQUEST_TIMEOUT: 'retry', ENGINE_TIMEOUT: 'retry', TIMEOUT: 'retry',
  WB_CLCO_CANCELLED: 'cancelled', CANCELLED: 'cancelled', REQUEST_CANCELLED: 'cancelled',
  ON_AI_MODEL_LIST_EMPTY: 'no_model', MODEL_NOT_CONFIGURED: 'no_model',
};
const AI_ERROR_GUIDE = {
  pending: { title: '권한 준비 중·확인 불가', text: '학생 잘못이 아닙니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.' },
  auth: { title: '인증 실패', text: '계정 연결을 다시 확인하고, 그래도 안 되면 담당자에게 확인하세요. Workbench 열쇠를 복사해 붙이지 마세요.' },
  blocked: { title: '접근 제한', text: '계정 연결을 다시 확인하고, 담당자에게 이용 권한과 운영 중지 여부를 확인하세요.' },
  limit: { title: '반 사용량·이용 한도', text: '담당자에게 확인하세요. 다시 눌러도 해결되지 않습니다.' },
  hours: { title: '이용 시간 아님', text: '지금은 AI 이용 시간이 아닙니다. 이용 시간을 확인하세요.' },
  retry: { title: '요청 제한·시간 초과·네트워크', text: '잠시 뒤 직접 다시 요청하세요. 자동으로 다시 요청하지 않습니다.' },
  cancelled: { title: '취소됨', text: '요청을 취소했습니다. 이전 결과는 현재 결과가 아닙니다.' },
  no_model: { title: '쓸 수 있는 모델 없음', text: '담당자에게 모델 허용 설정 확인을 요청하세요.' },
  general: { title: '확인 불가', text: '결과를 확인할 수 없습니다. 담당자에게 확인하고, 필요하면 직접 다시 요청하세요.' },
};
// 화면에는 영문 대문자 code만 그대로 쓴다. 그 밖의 값은 원문을 쓰지 않는다.
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

function safeAiError(error) {
  const code = error && SAFE_CODE.test(String(error.code)) ? String(error.code) : 'AI_REQUEST_UNVERIFIED';
  const raw = error && typeof error.message === 'string' ? error.message : '';
  const message = !raw ? '메시지 없음' : SECRET_LIKE.test(raw) ? '(비밀값으로 보여 가림)' : raw;
  return { code, message };
}

function aiErrorBox(error, what) {
  const safe = safeAiError(error);
  const group = Object.hasOwn(AI_ERROR_GROUP, safe.code) ? AI_ERROR_GROUP[safe.code] : 'general';
  const guide = AI_ERROR_GUIDE[group];
  const box = node('div', undefined, 'student-ai-error');
  box.dataset.errorGroup = group;
  const head = node('p', group === 'cancelled' ? `${what} 취소됨(${safe.code})` : `${what} 실패: ${guide.title}(${safe.code})`, 'state state-error');
  head.setAttribute('role', 'alert');
  box.append(head, node('p', `서버 안내: ${safe.message}`), node('p', `조치: ${guide.text}`));
  return box;
}

function renderAiConnectionView({ status, mode, data, error, checkedAt } = {}) {
  // 매번 새 요소를 만들므로 이전 점검 결과나 오류 안내가 남지 않는다.
  const root = node('div', undefined, 'student-ai-connection');
  // 실패·취소 응답은 mode가 항상 unknown으로 온다. 회사 시스템 연결 안내와 섞이지 않게 demo·disconnected만 알린다.
  const notice = mode === 'unknown' ? null : decisionModeNotice(mode);
  if (notice) root.append(notice);

  if (status === 'idle' || status == null) {
    root.dataset.state = 'idle';
    root.append(node('p', 'AI 연결 점검 전', 'state state-empty'), node('p', AI_RECHECK_HINT));
    return root;
  }
  if (status === 'loading') {
    root.dataset.state = 'loading';
    const box = node('p', 'AI 연결 점검 중', 'state state-loading');
    box.setAttribute('role', 'status');
    root.append(box, node('p', '취소하면 늦게 도착한 응답은 표시하지 않습니다.'));
    return root;
  }
  if (status === 'error') {
    root.dataset.state = 'error';
    root.append(aiErrorBox(error, 'AI 연결 점검'), node('p', '현재 점검 결과가 없으므로 AI 연결 성공으로 보지 마세요.'), node('p', AI_RECHECK_HINT));
    return root;
  }
  const audience = data && data.audienceAuthorization;
  if (status !== 'ok' || !data || data.transportChecked !== true || !Object.hasOwn(AI_AUDIENCE, audience)) {
    root.dataset.state = 'unknown';
    root.append(node('p', '확인 불가: AI 연결 점검 결과를 확인할 수 없습니다. 연결 성공으로 보지 마세요.', 'state state-empty'), node('p', AI_RECHECK_HINT));
    return root;
  }

  root.dataset.state = 'ok';
  root.dataset.audience = audience;
  const result = node('p', `연결 점검 완료: ${AI_AUDIENCE[audience]}`, 'state state-ok');
  result.setAttribute('role', 'status');
  root.append(result);
  if (audience === 'test') root.append(node('p', '시험 연결입니다. 실제 앱 권한 확인 결과가 아닙니다.'));
  const list = node('dl');
  row(list, '응답한 모델 수', node('span', Number.isFinite(data.modelCount) ? `${data.modelCount}개` : '확인 불가'));
  row(list, '점검 시각', node('span', formatTime(checkedAt)));
  root.append(list);
  root.append(node('p', '모델 목록 응답으로 연결만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다. 사건 설명은 보안 기록에서 따로 요청하고 확인하세요.'));
  root.append(node('p', AI_RECHECK_HINT));
  return root;
}

// ---------- 18단계: 근거에 연결된 AI 사건 설명 ----------

const EXPLANATION_KEPT = '기록은 그대로입니다. AI 설명 실패는 보안 기록과 업무 앱 판정을 바꾸지 않으며, 과제 실패가 아닙니다.';
const EXPLANATION_REFERENCE = 'AI 설명은 참고 정보입니다. 사실 판단은 아래 근거 글과 연동 시스템이 알려 준 상태를 기준으로 하세요. 설명·제안만으로 보안 조치가 실행되지 않습니다.';
// 실패 code별로 설명을 쓸 수 없는 까닭을 함께 알린다. 목록에 없는 code는 서버 안내만 보여 준다.
const EXPLANATION_FAILURE_REASON = {
  ON_AI_INVALID_OUTPUT: '실패 이유: 근거 불일치. AI 설명이 이 기록에 없는 근거 ID를 인용했거나 근거를 빠뜨렸거나, 지원하지 않는 조치를 제안했거나, 이미 실행했다고 답해(executed:true) 이 설명을 사용할 수 없습니다.',
  ON_AI_INVALID_INPUT: '실패 이유: 근거 부족. 이 기록의 근거·규칙을 확인할 수 없어 AI 설명을 요청하지 않았습니다.',
  SUBJECT_SCOPE_UNVERIFIED: '실패 이유: 현재 로그인과 이 기록의 연결을 확인할 수 없어 설명을 사용할 수 없습니다.',
};
const EXPLANATION_STATES = [['access', '접속', ACCESS_STATE], ['session', '세션', SESSION_STATUS], ['device', '기기', DEVICE_STATUS]];

function explanationErrorView(root, explanation, eventId) {
  root.dataset.state = 'error';
  if (eventId) root.append(node('p', `사건 ID: ${eventId}`));
  const error = explanation.error || {};
  root.append(aiErrorBox(error, 'AI 설명'));
  const safe = safeAiError(error);
  if (Object.hasOwn(EXPLANATION_FAILURE_REASON, safe.code)) root.append(node('p', EXPLANATION_FAILURE_REASON[safe.code]));
  root.append(node('p', EXPLANATION_KEPT));
  return root;
}

// 제공 코드가 이미 검사한 설명이라도, 화면에 붙이기 전에 지금 고른 기록과 다시 대조한다.
// 맞지 않으면 까닭만 돌려주며 근거를 새로 만들거나 고쳐 맞추지 않는다.
function explanationMismatch(event, data) {
  if (!data || typeof data.summary !== 'string' || data.summary.trim() === '') return 'AI 요약이 없습니다.';
  if (data.executed !== false) return 'AI가 이미 실행했다고 답한(executed:true) 설명은 사용할 수 없습니다.';
  if (data.requiresHumanConfirmation !== true) return '사람 확인 필요 여부(requiresHumanConfirmation)를 확인할 수 없습니다.';
  const evidence = Array.isArray(event.evidence) ? event.evidence : [];
  const known = new Set(evidence.map((item) => item && item.id));
  const refs = Array.isArray(data.evidenceIds) ? data.evidenceIds : [];
  if (refs.length === 0) return '인용한 근거 ID가 없습니다.';
  if (new Set(refs).size !== refs.length) return '같은 근거 ID를 중복 인용했습니다.';
  const missing = refs.filter((id) => !known.has(id)).length;
  if (missing > 0) return `이 기록에 없는 근거 ID ${missing}개를 인용했습니다.`;
  const proposals = Array.isArray(data.proposals) ? data.proposals : null;
  if (!proposals) return '조치 제안(proposals) 형식을 확인할 수 없습니다.';
  const supported = Array.isArray(event.supportedActions) ? event.supportedActions : [];
  for (const proposal of proposals) {
    if (!proposal || !supported.includes(proposal.action)) return '연동 시스템이 지원하지 않는 조치를 제안했습니다.';
    const ids = Array.isArray(proposal.evidenceIds) ? proposal.evidenceIds : [];
    if (ids.length === 0 || ids.some((id) => !known.has(id))) return '조치 제안이 이 기록에 없는 근거를 인용했습니다.';
  }
  return null;
}

function explanationSection(title, items, emptyText) {
  const section = node('section');
  section.append(node('h5', title));
  if (items.length === 0) { section.append(node('p', emptyText)); return section; }
  const list = node('ul');
  for (const item of items) list.append(item instanceof Element ? item : node('li', item));
  section.append(list);
  return section;
}

function renderExplanationView({ event, explanation, checkedAt } = {}) {
  // 매번 새 요소를 만들므로 다른 기록 선택·다시 불러오기·실패 때 이전 설명과 성공 표식이 남지 않는다.
  const root = node('div', undefined, 'student-explanation');
  const status = explanation && explanation.status;
  const eventId = event && event.id != null ? String(event.id) : null;
  // 실패 응답은 mode가 unknown으로 온다. 회사 시스템 연결 안내와 섞이지 않게 demo·disconnected만 알린다.
  const notice = explanation && explanation.mode !== 'unknown' ? decisionModeNotice(explanation.mode) : null;
  if (notice) root.append(notice);

  // 1) 실패는 event가 없어도 먼저 보여 준다.
  if (status === 'error') return explanationErrorView(root, explanation, eventId);
  if (!eventId) {
    root.dataset.state = 'no-event';
    const box = node('p', '보안 기록에서 기록을 먼저 고르세요. 고른 기록의 「AI 설명 요청」을 누르면 여기에 설명이 표시됩니다.', 'state state-empty');
    box.setAttribute('role', 'status');
    root.append(box);
    return root;
  }
  if (status === 'loading') {
    root.dataset.state = 'loading';
    const box = node('p', `AI 설명 요청 중: 사건 ID ${eventId}. 아직 설명이 도착하지 않았습니다.`, 'state state-loading');
    box.setAttribute('role', 'status');
    root.append(box);
    return root;
  }
  if (status !== 'ok') {
    root.dataset.state = status === 'idle' || status == null ? 'idle' : 'unknown';
    root.append(node('p', status === 'idle' || status == null
      ? `AI 설명 요청 전: 사건 ID ${eventId}. 보안 기록에서 「AI 설명 요청」을 누르세요.`
      : '확인 불가: AI 설명 결과를 확인할 수 없습니다. 기록은 그대로입니다.', 'state state-empty'));
    return root;
  }

  const data = explanation.data;
  const mismatch = explanationMismatch(event, data);
  if (mismatch) {
    // 근거가 맞지 않는 설명은 요약·근거를 그리지 않고 성공 표식도 붙이지 않는다.
    root.dataset.state = 'rejected';
    const box = node('p', `AI 설명 사용 불가(근거가 맞지 않음): 사건 ID ${eventId}`, 'state state-error');
    box.setAttribute('role', 'alert');
    root.append(box, node('p', `까닭: ${mismatch}`));
    const code = explanation.error && SAFE_CODE.test(String(explanation.error.code)) ? String(explanation.error.code) : null;
    if (code) root.append(node('p', `오류 코드: ${code}`));
    root.append(node('p', EXPLANATION_KEPT));
    return root;
  }

  // 2) 성공한 설명에만 성공 표식을 붙인다.
  root.dataset.state = 'ok';
  root.dataset.studentExplanationEvent = eventId;
  root.append(node('h4', 'AI 설명(참고용)'));
  const info = node('dl');
  row(info, '사건 ID', node('span', eventId));
  row(info, '설명 시각', node('span', formatTime(checkedAt)));
  root.append(info);
  const summary = node('p', data.summary);
  summary.dataset.part = 'summary';
  root.append(node('h5', 'AI 요약'), summary, node('p', EXPLANATION_REFERENCE));

  // 3) 인용한 근거 ID를 이 기록의 근거 글과 짝지어 보여 준다. 규칙은 id와 text를 함께 쓴다.
  const evidenceText = new Map(event.evidence.map((item) => [item.id, item.text]));
  root.append(explanationSection('인용한 근거', data.evidenceIds.map((id) => {
    const li = node('li', `${id} — ${evidenceText.get(id)}`);
    li.dataset.evidenceId = String(id);
    return li;
  }), '인용한 근거가 없습니다.'));
  const rules = Array.isArray(event.rules) ? event.rules : [];
  root.append(explanationSection('이 기록의 규칙', rules.map((rule) => {
    const li = node('li', `${rule && rule.id} — ${rule && rule.text}`);
    li.dataset.ruleId = String(rule && rule.id);
    return li;
  }), '이 기록에 규칙이 없습니다.'));

  // 4) 확인할 수 없는 상태는 원래 값과 함께 확인 불가로만 적고, 정상·안전으로 바꾸지 않는다.
  const state = event.state || {};
  const unknowns = EXPLANATION_STATES.filter(([key, , table]) => state[key] === 'unknown' || !Object.hasOwn(table, state[key]));
  root.append(explanationSection('확인 불가 상태', unknowns.map(([key, label]) => {
    const li = node('li', `${label}: 확인 불가(${String(state[key] ?? '값 없음')})`, 'state state-empty');
    li.dataset.unknownState = key;
    return li;
  }), '없음'));

  const proposals = data.proposals;
  const supported = Array.isArray(event.supportedActions) ? event.supportedActions : [];
  const proposalSection = explanationSection('AI 조치 제안', proposals.map((proposal) => {
    const li = node('li');
    li.dataset.proposalAction = String(proposal.action);
    li.dataset.executed = 'false';
    li.append(node('p', `조치: ${proposal.action} — 이유: ${proposal.reason}`),
      node('p', `근거 ID: ${proposal.evidenceIds.join(', ')}`),
      node('p', '상태: 미실행. 사람 확인이 필요하며 실행되지 않았습니다.', 'state state-empty'));
    return li;
  }), supported.length === 0
    ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
    : 'AI가 제안한 조치가 없습니다. 연동 시스템이 지원하는 조치는 있지만 이 설명에서는 제안하지 않았습니다.');
  root.append(proposalSection, node('p', 'AI는 어떤 조치도 실행하지 않았습니다(executed:false).'));
  return root;
}

// ---------- 19단계: 보안 조치 요청 상태와 실제 결과 구분 ----------

// status마다 뜻이 다른 문장을 원래 값과 함께 쓴다. 효과가 관측된 succeeded만 tone 'ok'이다.
const ACTION_STATUS = {
  idle: { text: '아직 미실행(idle): 조치를 준비하거나 연동 시스템에 전달하지 않았습니다.', tone: 'empty' },
  loading: { text: '조치 준비 또는 결과 조회 중(loading): 아직 결과가 없으며 완료 아님입니다.', tone: 'loading' },
  prepared: { text: '준비됨·미실행(prepared): 조치를 준비만 했으며 연동 시스템에 전달하지 않았습니다.', tone: 'empty' },
  executing: { text: '서버에 전달 중(executing): 결과가 아직 없으며 완료 아님입니다.', tone: 'loading' },
  pending: { text: '서버 접수·처리 중(pending): 서버가 요청을 받았다는 응답(ACK)이며, 조치 효과를 확인한 것이 아닙니다. 완료 아님입니다.', tone: 'loading' },
  succeeded: { text: '효과 확인(succeeded): 연동 시스템이 조치 효과를 관측했습니다.', tone: 'ok' },
  denied: { text: '거절(denied): 연동 시스템이 이 조치를 거절했습니다.', tone: 'error' },
  failed: { text: '실패(failed): 연동 시스템이 조치를 처리하지 못했습니다.', tone: 'error' },
  unknown: { text: '결과 불명(unknown): 효과 없음으로도 성공으로도 판단하지 마세요.', tone: 'error' },
  expired: { text: '확인 기한 지남(expired): 이번 준비로는 집행할 수 없습니다.', tone: 'error' },
  error: { text: '요청 처리 안 됨(error): 요청이 처리되지 않았습니다.', tone: 'error' },
};
// 제공 화면 버튼 이름을 그대로 안내한다. 학생 칸에는 버튼을 만들지 않는다.
const ACTION_GUIDE = {
  idle: '현재 기록에 연동 시스템이 지원하는 조치가 없으면(supportedActions 빈 배열) 「조치 준비」 버튼이 나오지 않으며, 이것이 정상입니다.',
  prepared: '실제 대상과 확인 기한을 읽은 뒤, 집행하려면 제공 화면의 「대상과 조치를 확인했으며 집행합니다」를 직접 누르세요. 누르기 전에는 실행되지 않습니다.',
  pending: '처리 결과는 제공 화면의 「원천 결과만 재조회」로 직접 조회하세요. 자동으로 다시 조회하지 않습니다.',
  unknown: '제공 화면의 「원천 결과만 재조회」로 결과만 다시 조회하세요. 같은 조치를 다시 집행하지 마세요.',
  expired: 'AI 설명의 제안에서 「조치 준비」를 다시 눌러 새로 준비하세요.',
};
const ACTION_CANCEL_NOTE = '「조치 화면 취소」는 화면만 비웁니다. 이미 연동 시스템에 전달된 조치의 효과를 되돌리지 않습니다.';

function safeActionText(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return SECRET_LIKE.test(value) ? '(비밀값으로 보여 가림)' : value;
}

// 받은 범위의 식별자만 글자로 보여 준다. 없는 값은 만들지 않는다.
function actionIdentifiers({ event, actionId, target, receipt, confirmationExpiresAt, status }) {
  const list = node('dl');
  const add = (label, value) => { if (value != null && value !== '') row(list, label, node('span', String(value))); };
  add('사건 ID(event.id)', event && event.id);
  const evidence = event && Array.isArray(event.evidence) ? event.evidence.map((item) => item && item.id).filter((id) => id != null) : [];
  if (evidence.length > 0) add('근거 ID', evidence.join(', '));
  add('조치(actionId)', actionId);
  add('실제 대상(target.id)', target && target.id);
  add('대상 세대(target.generation)', target && target.generation);
  add('요청 ID(requestId)', receipt && receipt.requestId);
  add('접수 번호(receiptId)', receipt && receipt.receiptId);
  add('버전(version)', receipt && receipt.version);
  if (receipt && typeof receipt.replayed === 'boolean') add('재응답 여부(replayed)', String(receipt.replayed));
  if (status === 'prepared' || status === 'expired') add('사람 확인 기한', confirmationExpiresAt ? formatTime(confirmationExpiresAt) : '확인 불가');
  return list.children.length > 0 ? list : null;
}

// 응답이 현재 사건·조치와 이어지는지 대조한다. 맞지 않으면 까닭을 돌려준다.
function actionBindingProblem({ event, actionId, receipt }) {
  if (!receipt) return null;
  if (receipt.eventId != null && event && receipt.eventId !== event.id) return '응답의 사건 ID가 현재 사건과 다릅니다.';
  if (receipt.actionId != null && actionId != null && receipt.actionId !== actionId) return '응답의 조치가 현재 조치와 다릅니다.';
  return null;
}

function renderActionView(input = {}) {
  // 매번 새 요소를 만들므로 이전 대상·요청·결과가 남지 않는다.
  const { event, actionId, target, receipt, observation, message, error } = input;
  const root = node('div', undefined, 'student-action');
  let status = Object.hasOwn(ACTION_STATUS, input.status) ? input.status : null;
  let unknownReason = status ? null : `받은 상태 값(${String(input.status ?? '값 없음')})을 확인할 수 없습니다.`;

  const binding = actionBindingProblem(input);
  if (binding && status !== 'idle') { status = 'unknown'; unknownReason = binding; }
  // succeeded는 연동 시스템이 효과를 관측(effectApplied: true)했고 접수 번호가 있을 때만 인정한다.
  if (status === 'succeeded' && !(observation && observation.effectApplied === true && observation.observedAt && receipt && receipt.receiptId)) {
    status = 'unknown';
    unknownReason = 'succeeded를 받았지만 연동 시스템의 효과 관측(effectApplied: true)·관측 시각·접수 번호를 확인할 수 없습니다.';
  }
  if (!status) status = 'unknown';

  const info = ACTION_STATUS[status];
  root.dataset.state = status;
  const head = node('p', info.text, `state state-${info.tone}`);
  head.setAttribute('role', info.tone === 'error' ? 'alert' : 'status');
  root.append(node('h4', '조치 상태'), head);
  if (unknownReason) root.append(node('p', `까닭: ${unknownReason}`));

  if (status === 'succeeded') {
    const result = node('dl');
    row(result, '관측 시각(observedAt)', node('span', formatTime(observation.observedAt)));
    row(result, '실제 효과', node('span', 'effectApplied: true'));
    row(result, '접수 번호(receiptId)', node('span', String(receipt.receiptId)));
    root.append(result);
  } else if (observation && observation.effectApplied === false) {
    root.append(node('p', `연동 시스템 관측: effectApplied: false (관측 시각 ${formatTime(observation.observedAt)}). 효과가 확인되지 않았습니다.`));
  }
  if (status === 'error' || status === 'denied' || status === 'failed' || status === 'expired' || (status === 'unknown' && error)) {
    const code = error && SAFE_CODE.test(String(error.code)) ? String(error.code) : 'ACTION_RESULT_UNVERIFIED';
    const detail = error ? `${code}: ${safeActionText(error.message) || '메시지 없음'}` : safeActionText(message) || '메시지 없음';
    root.append(node('p', `안내: ${detail}`));
  } else {
    const text = safeActionText(message);
    if (text && status !== 'succeeded') root.append(node('p', `제공 화면 안내: ${text}`));
  }
  if (receipt && receipt.superseded === true) root.append(node('p', '이전 조회는 최신 결과를 대신하지 않습니다(superseded).'));

  const ids = actionIdentifiers({ ...input, status });
  if (ids) root.append(node('h5', '현재 사건·요청'), ids);
  if (Object.hasOwn(ACTION_GUIDE, status)) root.append(node('p', ACTION_GUIDE[status]));
  if (status !== 'idle') root.append(node('p', ACTION_CANCEL_NOTE));

  // 현재 사건·조치와 맞게 그린 경우에만 사건·요청 표식을 붙인다.
  if (!binding && status !== 'idle') {
    if (event && event.id != null) root.dataset.studentActionEvent = String(event.id);
    if (receipt && receipt.requestId != null) root.dataset.studentActionRequest = String(receipt.requestId);
  }
  return root;
}

// ---------- 20단계: 설치 패키지 버전과 알려진 취약점 조회 결과 ----------

const OSV_RETRY_HINT = '다시 조회는 보호 현황의 「설치 패키지 조회」 버튼을 직접 누르세요. 자동으로 다시 조회하지 않습니다.';
const OSV_NOTICE = 'OSV는 알려진 취약점 데이터베이스입니다. 조회 결과가 없다는 사실만으로 해당 패키지나 앱 전체가 안전하다고 보장할 수 없습니다.';
// 전체 조회 상태. 미조회·조회 실패는 "취약점 없음"으로 쓰지 않는다.
const SCAN_STATUS_TEXT = {
  complete: { text: '모두 조회(complete): 조회 대상 패키지를 OSV에서 끝까지 조회했습니다.', tone: 'ok' },
  partial: { text: '일부 조회 실패(partial): 일부 패키지는 조회를 끝까지 확인하지 못했습니다. 이미 받은 취약점 ID는 그대로 표시합니다.', tone: 'error' },
  not_checked: { text: '아직 조회 안 함(not_checked): 승인된 공개 조회 대상 패키지가 없어 OSV를 조회하지 않았습니다. 취약점 없음이 아닙니다.', tone: 'empty' },
  not_configured: { text: '조회 준비 미완료(not_configured): 조회 대상 프로젝트 설정이 필요합니다. 설정은 담당자가 준비하며, 취약점 없음이 아닙니다.', tone: 'empty' },
  unverifiable: { text: 'lock 파일 확인 불가(unverifiable): package-lock.json을 확인할 수 없어 조회하지 않았습니다. 취약점 없음이 아닙니다.', tone: 'error' },
};
// 1.2.3 같은 정확한 버전만 설치 버전으로 인정한다. ^1.2.0 같은 범위는 설치 버전이 아니다.
const EXACT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function packageStatusText(pkg, vulnerabilities) {
  if (pkg.status === 'known_vulnerabilities') return { text: `알려진 항목 있음(known_vulnerabilities): ${vulnerabilities.length}건`, tone: 'error' };
  if (pkg.status === 'none_found') return { text: '알려진 항목 없음(none_found): 조회 시점에 OSV 조회 범위에서 알려진 항목이 없다는 뜻이며, 안전을 보장하지 않습니다.', tone: 'ok' };
  if (pkg.status === 'unverifiable' && vulnerabilities.length > 0) return { text: `일부 확인·전체 조회 확인 불가(unverifiable): 받은 항목 ${vulnerabilities.length}건만 표시합니다.`, tone: 'error' };
  if (pkg.status === 'unverifiable') return { text: '조회 확인 불가(unverifiable): 조회를 끝까지 확인하지 못했습니다. 취약점 없음이 아닙니다.', tone: 'error' };
  return { text: `확인 불가(${String(pkg.status ?? '값 없음')}): 조회 상태를 확인할 수 없습니다.`, tone: 'empty' };
}

function cell(tag, ...children) {
  const td = node(tag);
  for (const child of children) td.append(typeof child === 'string' ? node('span', child) : child);
  return td;
}

function packageRow(pkg) {
  const tr = node('tr');
  const name = pkg && pkg.name != null ? String(pkg.name) : '이름 확인 불가';
  const exact = pkg && typeof pkg.version === 'string' && EXACT_VERSION.test(pkg.version);
  tr.dataset.studentPackageName = name;
  // 정확한 설치 버전일 때만 버전 속성을 붙인다. 범위·빈 값을 버전처럼 쓰지 않는다.
  if (exact) tr.dataset.studentPackageVersion = pkg.version;
  const vulnerabilities = pkg && Array.isArray(pkg.vulnerabilities) ? pkg.vulnerabilities : [];
  const status = packageStatusText(pkg || {}, vulnerabilities);
  tr.dataset.status = String(pkg && pkg.status);
  let findings;
  if (vulnerabilities.length === 0) {
    findings = node('span', pkg && pkg.status === 'none_found' ? '없음(none_found)' : '받은 항목 없음 · 취약점 없음이 아님');
  } else {
    findings = node('ul');
    for (const item of vulnerabilities) {
      const li = node('li', `${item && item.id} (수정 시각 modified: ${formatTime(item && item.modified)})`);
      li.dataset.vulnerabilityId = String(item && item.id);
      findings.append(li);
    }
  }
  tr.append(
    cell('th', name),
    cell('td', exact ? pkg.version : `정확한 설치 버전 확인 불가(받은 값: ${String((pkg && pkg.version) ?? '값 없음')})`),
    cell('td', node('span', status.text, `state state-${status.tone}`)),
    cell('td', findings),
    cell('td', String((pkg && pkg.source) ?? '확인 불가')),
    cell('td', formatTime(pkg && pkg.checkedAt)),
  );
  tr.firstChild.setAttribute('scope', 'row');
  return tr;
}

function packageTable(packages) {
  const table = node('table', undefined, 'student-package-table');
  table.append(node('caption', `설치 패키지 조회 결과 ${packages.length}건`));
  const head = node('tr');
  for (const label of ['패키지(name)', '설치 버전(version)', '조회 상태(status)', '취약점 ID·수정 시각', '출처(source)', '패키지 조회 시각(checkedAt)']) {
    const th = node('th', label);
    th.setAttribute('scope', 'col');
    head.append(th);
  }
  const thead = node('thead');
  thead.append(head);
  const tbody = node('tbody');
  for (const pkg of packages) tbody.append(packageRow(pkg));
  table.append(thead, tbody);
  return table;
}

function renderVulnerabilitiesView({ status, mode, data, error } = {}) {
  // 매번 새 요소를 만들므로 조회 중·오류일 때 이전 표가 현재 결과처럼 남지 않는다.
  const root = node('div', undefined, 'student-vulnerabilities');
  const notice = mode === 'unknown' ? null : decisionModeNotice(mode);
  if (notice) root.append(notice);

  if (status === 'idle' || status == null) {
    root.dataset.state = 'idle';
    root.append(node('p', '조회 전: 아직 설치 패키지를 조회하지 않았습니다. 취약점 없음이 아닙니다.', 'state state-empty'), node('p', OSV_RETRY_HINT));
    return root;
  }
  if (status === 'loading') {
    root.dataset.state = 'loading';
    const box = node('p', '조회 중: 결과가 아직 없습니다. 이전 조회 결과는 표시하지 않습니다.', 'state state-loading');
    box.setAttribute('role', 'status');
    root.append(box, node('p', '「패키지 조회 취소」를 누르면 늦게 도착한 응답은 표시하지 않습니다.'));
    return root;
  }
  if (status === 'error') {
    root.dataset.state = 'error';
    const code = error && SAFE_CODE.test(String(error.code)) ? String(error.code) : null;
    const message = error && typeof error.message === 'string' && error.message ? safeDiagnosticValue(error.message) : '서버 메시지 없음';
    const head = code === 'CANCELLED' || code === 'REQUEST_CANCELLED' ? '조회 취소' : '조회 실패';
    const box = node('p', `${head}: ${message}${code ? ` (${code})` : ''}`, 'state state-error');
    box.setAttribute('role', 'alert');
    root.append(box, node('p', '이전 조회 결과를 현재 결과로 보지 않습니다. 조회 실패는 취약점 없음이 아닙니다.'), node('p', OSV_RETRY_HINT));
    return root;
  }
  const scanStatus = data && data.status;
  if (status !== 'ok' || !data || !Object.hasOwn(SCAN_STATUS_TEXT, scanStatus)) {
    root.dataset.state = 'unknown';
    root.append(node('p', `확인 불가: 조회 결과 상태(${String(scanStatus ?? status ?? '값 없음')})를 확인할 수 없습니다. 취약점 없음이 아닙니다.`, 'state state-empty'), node('p', OSV_RETRY_HINT));
    return root;
  }

  root.dataset.state = 'ok';
  root.dataset.scan = scanStatus;
  const info = SCAN_STATUS_TEXT[scanStatus];
  const head = node('p', info.text, `state state-${info.tone}`);
  head.setAttribute('role', 'status');
  root.append(node('h4', '전체 조회 결과'), head);

  // 전달된 값만 보여 준다. 설정·lock 확인 불가일 때는 lock 정보가 없다.
  const summary = node('dl');
  if (data.code != null) row(summary, '결과 코드', node('span', safeDiagnosticValue(data.code)));
  if (data.lockfileVersion != null) {
    row(summary, '설치 목록 원천', node('span', 'package-lock.json과 설치된 node_modules 메타데이터 대조'));
    row(summary, 'lock 파일 버전(lockfileVersion)', node('span', String(data.lockfileVersion)));
  }
  if (data.lockfileHash != null) row(summary, 'lock 파일 해시(lockfileHash)', node('span', String(data.lockfileHash)));
  if (data.excluded && Number.isSafeInteger(data.excluded.count)) row(summary, '조회 제외', node('span', `${data.excluded.count}건(비공개·미승인 등, 이름은 외부로 보내지 않음)`));
  if (data.checkedAt != null) row(summary, '조회 시각(checkedAt)', node('span', formatTime(data.checkedAt)));
  root.append(summary);

  const packages = Array.isArray(data.packages) ? data.packages : [];
  if (packages.length > 0) {
    const count = (value) => packages.filter((pkg) => pkg && pkg.status === value).length;
    root.append(node('p', `알려진 항목 있음 ${count('known_vulnerabilities')}건 · 알려진 항목 없음 ${count('none_found')}건 · 조회 확인 불가 ${count('unverifiable')}건`));
    root.append(packageTable(packages));
  } else if (scanStatus === 'complete') {
    root.append(node('p', '표시할 패키지 조회 결과가 없습니다.'));
  }
  root.append(node('p', OSV_NOTICE), node('p', OSV_RETRY_HINT));
  return root;
}

// ---------- 권장 제작 기간: 관제 대시보드(보호 현황 renderStatus 칸) ----------
// 맨 위 상태 카드 4개 → 내 PC 실측과 추이 → 이상 징후 근거 기록 → 16단계 상세 순서로 보여 준다.
// 실측(이 PC·이 앱 서버가 이번에 돌려준 값)과 예시(설명용 고정 값)는 섞지 않는다.

const PC_PATH = '/api/pc/status';
const PC_SCHEMA = 'aleph.on.pc-status.v1';
const PC_STALE_MS = 60 * 1000;
const PC_HISTORY_MAX = 10;
const PC_ITEMS = ['CPU', '메모리', '디스크', 'Windows 방화벽', 'Windows 기록'];
const FIREWALL_PROFILES = ['Domain', 'Private', 'Public'];
const MEASURED_TAG = '실측';
const EXAMPLE_TAG = '예시(실제 조회 아님)';

const isNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isCount = (n) => Number.isSafeInteger(n) && n >= 0;
const gigabytes = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

// 받은 PC 값을 항목별로 다시 확인한다. 형식이 맞지 않는 항목은 값을 버리고 확인 불가로 둔다.
function readPcMetrics(metrics = {}) {
  const out = { cpu: null, memory: null, disk: null, firewall: null, events: null };
  const { cpu, memory, disk, firewall, events } = metrics;
  if (cpu?.state === 'ok' && isNumber(cpu.usagePercent) && cpu.usagePercent <= 100) out.cpu = { percent: cpu.usagePercent, sampleMs: cpu.sampleMs };
  if (memory?.state === 'ok' && isNumber(memory.usedBytes) && isNumber(memory.totalBytes) && memory.totalBytes > 0 && memory.usedBytes <= memory.totalBytes) out.memory = { used: memory.usedBytes, total: memory.totalBytes };
  if (disk?.state === 'ok' && isNumber(disk.freeBytes) && isNumber(disk.totalBytes) && disk.totalBytes > 0 && disk.freeBytes <= disk.totalBytes) out.disk = { free: disk.freeBytes, total: disk.totalBytes };
  if (firewall?.state === 'ok' && Array.isArray(firewall.profiles) && FIREWALL_PROFILES.every((name) => firewall.profiles.some((p) => p?.name === name && typeof p.enabled === 'boolean'))) {
    out.firewall = FIREWALL_PROFILES.map((name) => ({ name, enabled: firewall.profiles.find((p) => p.name === name).enabled }));
  }
  if (events?.state === 'ok' && isCount(events.warningCount) && isCount(events.errorCount) && typeof events.truncated === 'boolean') {
    out.events = { warnings: events.warningCount, errors: events.errorCount, truncated: events.truncated, since: events.since };
  }
  const reasons = {};
  for (const [key, raw] of Object.entries({ cpu, memory, disk, firewall, events })) if (!out[key]) reasons[key] = SAFE_CODE.test(String(raw?.reason ?? '').toUpperCase()) ? String(raw.reason) : 'invalid_response';
  return { ...out, reasons };
}

function countMeasured(read) {
  return ['cpu', 'memory', 'disk', 'firewall', 'events'].filter((key) => read[key]).length;
}

// 앱 서버 응답을 상태 하나로 정리한다. 실패·지원 없음·형식 확인 불가를 서로 다르게 둔다.
function classifyPcResult(result) {
  if (!result || result.ok !== true) {
    const raw = result?.error?.code;
    const code = SAFE_CODE.test(String(raw ?? '')) ? raw : 'UNKNOWN_ERROR';
    return code === 'NOT_ALLOWED' ? { status: 'unsupported', code } : { status: 'failed', code };
  }
  const data = result.data;
  const at = typeof data?.measuredAt === 'string' ? Date.parse(data.measuredAt) : NaN;
  if (data?.schema !== PC_SCHEMA || data.source !== 'local-pc' || !Number.isFinite(at)) return { status: 'unverifiable', code: 'PC_SHAPE_UNVERIFIED' };
  const read = readPcMetrics(data.metrics);
  return { status: 'ok', measuredAt: data.measuredAt, read };
}

function pcCardState(pc, now) {
  if (pc.status === 'idle') return { tone: 'empty', text: '아직 조회 안 함(확인 불가)', next: '아래 「내 PC 실측 조회」를 직접 누르세요.' };
  if (pc.status === 'loading') return { tone: 'loading', text: '조회 중', next: '결과가 오기 전에는 이전 값을 현재 값으로 보지 않습니다.' };
  if (pc.status === 'unsupported') return { tone: 'empty', text: `지원 없음(${pc.code})`, next: '위쪽 제공 카드 「내 PC 상태」에서 확인하세요.' };
  if (pc.status === 'failed') return { tone: 'error', text: `조회 실패(${pc.code})`, next: '이전 값은 현재 상태가 아닙니다. 다시 조회하세요.' };
  if (pc.status === 'unverifiable') return { tone: 'empty', text: `확인 불가(${pc.code})`, next: '응답 형식을 확인하지 못했습니다. 정상으로 보지 않습니다.' };
  const measured = countMeasured(pc.read);
  const missing = PC_ITEMS.length - measured;
  if (now - Date.parse(pc.measuredAt) > PC_STALE_MS) return { tone: 'empty', text: `오래됨: 마지막 실측 ${formatTime(pc.measuredAt)}`, next: '1분이 지났습니다. 현재 상태로 보려면 다시 조회하세요.' };
  if (!measured) return { tone: 'empty', text: `응답은 왔지만 실측 0/${PC_ITEMS.length}`, next: '항목을 하나도 읽지 못했으므로 성공으로 보지 않습니다.' };
  return { tone: missing ? 'empty' : 'ok', text: `실측 ${measured}/${PC_ITEMS.length}${missing ? ` · 확인 불가 ${missing}개` : ''}`, next: '값은 아래 「내 PC 실측과 추이」에서 봅니다.' };
}

function engineCardState({ devices, sessions, notifications, mode } = {}) {
  const items = Array.isArray(notifications) ? notifications : [];
  const notConnected = items.filter((item) => item && item.code === 'ENGINE_NOT_CONNECTED').length;
  if (devices?.status === 'loading' || sessions?.status === 'loading') return { tone: 'loading', text: '불러오는 중', next: '결과를 기다립니다.' };
  if (mode === 'disconnected' || notConnected) return { tone: 'error', text: `연결 없음${notConnected ? ` · ENGINE_NOT_CONNECTED ${notConnected}건` : ''}`, next: '담당자 안내가 있을 때만 SDP 연결 설정으로 실행합니다.' };
  if (mode === 'demo') return { tone: 'empty', text: '예제 자료(demo)', next: '실제 회사 시스템의 값이 아닙니다.' };
  if (mode === 'connected' && devices?.status === 'ok' && sessions?.status === 'ok') return { tone: 'ok', text: '연결됨: 기기·세션 응답 받음', next: '아래 상세에서 기기·세션 상태를 봅니다.' };
  return { tone: 'empty', text: '확인 불가', next: '위쪽 「다시 불러오기」를 직접 누르세요.' };
}

function aiCardState(ai) {
  if (!ai || ai.status === 'idle' || ai.status == null) return { tone: 'empty', text: '점검 전', next: '「AI 연결」 카드의 계정 연결·AI 앱 승인 뒤 「현재 API 연결 점검」을 직접 누르세요.' };
  if (ai.status === 'loading') return { tone: 'loading', text: '점검 중', next: '결과를 기다립니다.' };
  if (ai.status === 'error') {
    const code = SAFE_CODE.test(String(ai.error?.code ?? '')) ? ai.error.code : 'UNKNOWN_ERROR';
    return { tone: 'error', text: `점검 실패(${code})`, next: '연결 성공으로 보지 않습니다. 원인은 아래 「학생 AI 연결 표시」에서 봅니다.' };
  }
  if (ai.status === 'ok' && ai.data?.transportChecked === true && Object.hasOwn(AI_AUDIENCE, ai.data.audienceAuthorization)) {
    return { tone: 'ok', text: `모델 응답 확인: ${AI_AUDIENCE[ai.data.audienceAuthorization]}`, next: '모델 목록만 점검했습니다. 사건 설명 성공과는 별개입니다.', at: ai.checkedAt };
  }
  return { tone: 'empty', text: '확인 불가', next: '점검 결과를 확인할 수 없습니다.' };
}

function scanCardState(scan) {
  if (!scan || scan.status === 'idle' || scan.status == null) return { tone: 'empty', text: '조회 전(취약점 없음 아님)', next: '「설치 패키지 조회」를 직접 누르세요.' };
  if (scan.status === 'loading') return { tone: 'loading', text: '조회 중', next: '이전 결과는 현재 결과가 아닙니다.' };
  if (scan.status === 'error') {
    const code = SAFE_CODE.test(String(scan.error?.code ?? '')) ? scan.error.code : 'UNKNOWN_ERROR';
    return { tone: 'error', text: `조회 실패(${code})`, next: '취약점 없음이 아닙니다. 다시 조회하세요.' };
  }
  const data = scan.data || {};
  const known = Object.hasOwn(SCAN_STATUS_TEXT, data.status) ? SCAN_STATUS_TEXT[data.status] : null;
  if (scan.status !== 'ok' || !known) return { tone: 'empty', text: '확인 불가', next: '조회 결과 형식을 확인하지 못했습니다.' };
  const code = SAFE_CODE.test(String(data.code ?? '')) ? ` · ${data.code}` : '';
  const tone = data.status === 'complete' ? 'ok' : data.status === 'partial' ? 'error' : 'empty';
  return { tone, text: `${known}${code}`, next: data.status === 'complete' ? 'OSV에 알려진 항목만 대조했습니다. 전체 안전 보장이 아닙니다.' : '취약점 없음으로 보지 않습니다.', at: data.checkedAt };
}

function statusCard(title, source, state) {
  const card = node('section', undefined, 'card');
  card.dataset.studentCard = title;
  const head = node('h4', `${title} `);
  head.append(node('span', MEASURED_TAG, 'tag tag-student'));
  card.append(head);
  card.append(node('p', state.text, `state state-${state.tone}`));
  card.append(node('p', `확인 시각: ${state.at ? formatTime(state.at) : '없음'}`, 'muted'));
  card.append(node('p', `다음 행동: ${state.next}`));
  card.append(node('p', `출처: ${source}`, 'muted'));
  return card;
}

function pcValueRows(read, reasons) {
  const list = node('dl', undefined, 'kv');
  const missing = (key) => node('span', `확인 불가(${reasons[key]})`, 'state state-empty');
  row(list, 'CPU', read.cpu ? node('span', `${read.cpu.percent.toFixed(1)}% 사용 (짧은 표본 1회)`) : missing('cpu'));
  row(list, '메모리', read.memory ? node('span', `${gigabytes(read.memory.used)} / ${gigabytes(read.memory.total)} 사용`) : missing('memory'));
  row(list, '디스크', read.disk ? node('span', `${gigabytes(read.disk.free)} 여유 / ${gigabytes(read.disk.total)}`) : missing('disk'));
  row(list, 'Windows 방화벽', read.firewall ? node('span', read.firewall.map((p) => `${p.name} ${p.enabled ? '켜짐' : '꺼짐'}`).join(' · ')) : missing('firewall'));
  row(list, 'Windows 기록', read.events ? node('span', `최근 24시간 경고 ${read.events.warnings}건 · 오류 ${read.events.errors}건${read.events.truncated ? ' (최대 5,000건 일부 집계)' : ''}`) : missing('events'));
  return list;
}

function historyTable(history) {
  const table = node('table');
  const caption = node('caption', `최근 조회 ${history.length}회 (새로운 것이 위, 최대 ${PC_HISTORY_MAX}회)`);
  table.append(caption);
  const head = node('tr');
  for (const h of ['측정·시도 시각', '결과', 'CPU', '메모리 사용률', '디스크 여유']) { const th = node('th', h); th.setAttribute('scope', 'col'); head.append(th); }
  const thead = node('thead'); thead.append(head); table.append(thead);
  const body = node('tbody');
  history.forEach((entry, i) => {
    const tr = node('tr');
    const older = history[i + 1];
    const cpu = entry.read?.cpu ? `${entry.read.cpu.percent.toFixed(1)}%` : '확인 불가';
    const delta = entry.read?.cpu && older?.read?.cpu ? ` (${entry.read.cpu.percent - older.read.cpu.percent >= 0 ? '+' : ''}${(entry.read.cpu.percent - older.read.cpu.percent).toFixed(1)}%p)` : '';
    const mem = entry.read?.memory ? `${Math.round((entry.read.memory.used / entry.read.memory.total) * 100)}%` : '확인 불가';
    const disk = entry.read?.disk ? gigabytes(entry.read.disk.free) : '확인 불가';
    const result = entry.status === 'ok' ? `실측 ${countMeasured(entry.read)}/${PC_ITEMS.length}` : `${entry.status === 'failed' ? '실패' : '확인 불가'}(${entry.code})`;
    for (const text of [formatTime(entry.at), result, cpu + delta, mem, disk]) tr.append(node('td', text));
    body.append(tr);
  });
  table.append(body);
  return table;
}

// 이상 징후는 판정이 아니라 관찰이다. 각 항목에 「무엇을 봤는지」와 「그것만으로 말할 수 없는 것」을 함께 둔다.
function collectSignals(statusInput, pc) {
  const out = [];
  const items = Array.isArray(statusInput?.notifications) ? statusInput.notifications : [];
  for (const item of items) {
    out.push({
      what: `[${resourceName(item && item.resource)}] ${safeDiagnosticValue(item && item.code)}`,
      source: '앱 서버 응답(보호 현황 알림)',
      limit: item && item.code === 'ENGINE_NOT_CONNECTED' ? '연결이 없다는 사실입니다. 공격이나 침해를 뜻하지 않습니다.' : '앱이 받은 상태 값입니다. 원인은 따로 확인해야 합니다.',
    });
  }
  if (pc.status === 'ok' && Date.now() - Date.parse(pc.measuredAt) <= PC_STALE_MS) {
    const { read } = pc;
    const at = formatTime(pc.measuredAt);
    const off = read.firewall ? read.firewall.filter((p) => !p.enabled).map((p) => p.name) : [];
    if (off.length) out.push({ what: `Windows 방화벽 꺼진 프로필: ${off.join(', ')}`, source: `이 PC 실측 · ${at}`, limit: '설정 관찰입니다. 이 앱은 설정을 바꾸지 않습니다.' });
    if (read.events && read.events.errors > 0) out.push({ what: `최근 24시간 Windows 오류 기록 ${read.events.errors}건${read.events.truncated ? ' (일부 집계)' : ''}`, source: `이 PC 실측 · ${at}`, limit: '건수만 셌습니다. 기록 내용이 없으므로 침해 판정이 아닙니다.' });
    if (read.cpu && read.cpu.percent >= 90) out.push({ what: `CPU ${read.cpu.percent.toFixed(1)}%`, source: `이 PC 실측 · ${at}`, limit: '짧은 표본 한 번입니다. 어떤 프로그램인지, 계속되는지 더 봐야 합니다.' });
    if (read.memory && read.memory.used / read.memory.total >= 0.85) out.push({ what: `메모리 사용 ${Math.round((read.memory.used / read.memory.total) * 100)}%`, source: `이 PC 실측 · ${at}`, limit: '사용량만으로 악성코드를 판정하지 않습니다.' });
    if (read.disk && read.disk.free / read.disk.total < 0.1) out.push({ what: `디스크 여유 ${gigabytes(read.disk.free)}`, source: `이 PC 실측 · ${at}`, limit: '공간 부족 관찰입니다. 지우기 전에 파일을 확인합니다.' });
  }
  return out;
}

const EXAMPLE_ROWS = [
  ['10:00:00', '실측 5/5', '35.0%', '62%', '120.0 GB'],
  ['10:05:00', '실패(TIMEOUT)', '확인 불가', '확인 불가', '확인 불가'],
  ['10:10:00', '실측 3/5', '92.0%', '88%', '80.0 GB'],
];

function exampleSection() {
  const section = node('section', undefined, 'card');
  section.id = 'student-dashboard-example';
  section.dataset.example = 'true';
  const head = node('h4', '예시 화면 ');
  head.append(node('span', EXAMPLE_TAG, 'tag tag-demo'));
  section.append(head);
  section.append(node('p', '설명용 고정 값입니다. 이 PC에서 잰 값이 아니며, 위 상태 카드·실측 추이·이상 징후 기록에 섞지 않습니다. 실패와 일부 실측이 표에서 어떻게 보이는지 보여 주려는 것입니다.', 'muted'));
  const table = node('table');
  table.append(node('caption', `${EXAMPLE_TAG}: 추이 표 모양`));
  const head2 = node('tr');
  for (const h of ['측정 시각(예시)', '결과', 'CPU', '메모리 사용률', '디스크 여유']) { const th = node('th', h); th.setAttribute('scope', 'col'); head2.append(th); }
  const thead = node('thead'); thead.append(head2); table.append(thead);
  const body = node('tbody');
  for (const values of EXAMPLE_ROWS) { const tr = node('tr'); tr.dataset.example = 'true'; for (const v of values) tr.append(node('td', `${v} (예시)`)); body.append(tr); }
  table.append(body);
  section.append(table);
  return section;
}

function createDashboard({ api, onChange }) {
  let pc = { status: 'idle' };
  let pcGeneration = 0;
  let history = [];
  let showExample = false;
  let lastStatus = null;
  let lastAi = null;
  let lastScan = null;
  let root = null;
  let cards = null;
  let pendingFocus = null;
  const changed = () => { if (typeof onChange === 'function') onChange(); };

  // 버튼을 누를 때만 한 번 읽는다. 그리기나 onChange 안에서는 조회하지 않는다(서로 부르며 끝없이 도는 것을 막는다).
  async function probePc() {
    if (pc.status === 'loading') return;
    if (!api || typeof api.get !== 'function') { pc = { status: 'unsupported', code: 'NO_STUDENT_API' }; changed(); return; }
    const own = ++pcGeneration;
    pc = { status: 'loading' };
    changed();
    let result;
    try { result = await api.get(PC_PATH); } catch { result = { ok: false, error: { code: 'CLIENT_ERROR' } }; }
    if (own !== pcGeneration) return;
    pc = classifyPcResult(result);
    history = [{ at: pc.measuredAt ?? new Date().toISOString(), status: pc.status, code: pc.code ?? null, read: pc.read ?? null }, ...history].slice(0, PC_HISTORY_MAX);
    changed();
  }

  function renderCards() {
    const now = Date.now();
    const pcState = pcCardState(pc, now);
    if (pc.status === 'ok') pcState.at = pc.measuredAt;
    return [
      statusCard('내 PC', `이 PC 실측(${PC_PATH})`, pcState),
      statusCard('기존 서버(SDP) 연결', '앱 서버 응답(기기·세션·알림)', engineCardState(lastStatus || {})),
      statusCard('AI 연결', '앱 서버의 AI 연결 점검 결과', aiCardState(lastAi)),
      statusCard('설치 패키지 조회', '앱 서버의 OSV 조회 결과', scanCardState(lastScan)),
    ];
  }

  // AI·패키지 칸은 보호 현황 칸보다 늦게 그려질 수 있어, 받은 즉시 이 칸의 상태 카드만 바꿔 그린다.
  function refreshCards() {
    if (cards && cards.isConnected) cards.replaceChildren(...renderCards());
  }

  function button(text, key, onClick, extra) {
    const b = node('button', text, 'btn');
    b.type = 'button';
    b.dataset.focusKey = key;
    if (extra) extra(b);
    b.addEventListener('click', onClick);
    return b;
  }

  function rememberFocus() {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && root && root.contains && root.contains(active) && active.dataset && active.dataset.focusKey) pendingFocus = active.dataset.focusKey;
  }

  function restoreFocus() {
    const key = pendingFocus;
    pendingFocus = null;
    if (!key || !root || !root.isConnected || !root.querySelector) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    const target = root.querySelector(`[data-focus-key="${key}"]`);
    if (target) target.focus({ preventScroll: true });
  }

  function pcSection() {
    const section = node('section');
    section.append(node('h4', '내 PC 실측과 추이'));
    section.append(node('p', '「내 PC 실측 조회」를 누를 때만 이 PC 값을 한 번 읽습니다. 자동으로 다시 읽지 않습니다. 추이는 이 화면을 연 동안만 기억하며, 새로고침하거나 앱을 끄면 사라집니다.', 'muted'));
    const loading = pc.status === 'loading';
    section.append(button(loading ? '조회 중…' : '내 PC 실측 조회', 'pc-probe', () => { void probePc(); }, (b) => { if (loading) b.setAttribute('aria-disabled', 'true'); }));
    const result = node('p', undefined, 'state');
    result.setAttribute('role', 'status');
    const state = pcCardState(pc, Date.now());
    result.className = `state state-${state.tone}`;
    result.textContent = pc.status === 'ok' ? `${state.text} · 측정 ${formatTime(pc.measuredAt)} · 출처 local-pc` : state.text;
    section.append(result);
    if (pc.status === 'ok') {
      const values = node('div');
      const head = node('p', '이번 조회 값 ');
      head.append(node('span', MEASURED_TAG, 'tag tag-student'));
      values.append(head, pcValueRows(pc.read, pc.read.reasons));
      section.append(values);
    } else if (history.some((h) => h.status === 'ok')) {
      section.append(node('p', '이전 실측은 아래 추이 표에만 남깁니다. 현재 값으로 보지 않습니다.', 'muted'));
    }
    if (history.length) section.append(historyTable(history));
    else section.append(node('p', '아직 쌓인 실측이 없습니다. 조회한 적이 없는 상태를 정상으로 보지 않습니다.', 'state state-empty'));
    return section;
  }

  function signalSection() {
    const section = node('section');
    section.append(node('h4', '이상 징후 근거 기록'));
    section.append(node('p', '판정이 아니라 관찰입니다. 출처·시각과 그것만으로 말할 수 없는 것을 함께 적습니다. 방화벽이 모두 켜진 것은 목록에 넣지 않습니다.', 'muted'));
    const signals = collectSignals(lastStatus, pc);
    if (!signals.length) {
      section.append(node('p', pc.status === 'ok' ? '이번에 모은 관찰이 없습니다. 이상 없음이나 안전 판정은 아닙니다.' : '모은 관찰이 없습니다. PC 실측 전이므로 이상 없음으로 보지 않습니다.', 'state state-empty'));
      return section;
    }
    const list = node('ul', undefined, 'plain-list');
    for (const s of signals) {
      const li = node('li');
      li.append(node('p', s.what, 'item-title'), node('p', `출처·시각: ${s.source}`, 'muted'), node('p', `이것만으로 말할 수 없는 것: ${s.limit}`));
      list.append(li);
    }
    section.append(list);
    return section;
  }

  return {
    render(input = {}) {
      rememberFocus();
      lastStatus = input;
      const next = node('div', undefined, 'student-dashboard');
      next.append(node('h3', '관제 대시보드'));
      const legend = node('p', '표시: ');
      legend.append(node('span', MEASURED_TAG, 'tag tag-student'), node('span', ' = 이 PC·이 앱 서버가 이번에 돌려준 값, '), node('span', EXAMPLE_TAG, 'tag tag-demo'), node('span', ' = 설명용 고정 값'));
      next.append(legend);
      cards = node('div', undefined, 'grid-2');
      cards.dataset.studentCards = 'status';
      cards.append(...renderCards());
      next.append(cards);
      next.append(pcSection());
      next.append(signalSection());
      const toggle = button(showExample ? '예시 숨기기' : '예시 보기', 'example-toggle', () => { showExample = !showExample; changed(); }, (b) => {
        b.setAttribute('aria-pressed', showExample ? 'true' : 'false');
        b.setAttribute('aria-controls', 'student-dashboard-example');
      });
      next.append(toggle);
      if (showExample) next.append(exampleSection());
      const detail = node('section');
      detail.append(node('h4', '상세 근거: 등록 기기·현재 세션·알림·도움정보'));
      detail.append(renderStatusView(input));
      next.append(detail);
      root = next;
      if (pendingFocus) queueMicrotask(restoreFocus);
      return next;
    },
    noteAi(input) { lastAi = input; refreshCards(); },
    noteScan(input) { lastScan = input; refreshCards(); },
  };
}

export function createStudentView({ api, onChange } = {}) {
  const dashboard = createDashboard({ api, onChange });
  return {
    renderIdentity(input) { return renderIdentityView(input); },
    renderDecision(input) { return renderDecisionView(input); },
    renderEvents(input) { return renderEventsView(input); },
    renderStatus(input) { return dashboard.render(input); },
    renderVulnerabilities(input) { dashboard.noteScan(input); return renderVulnerabilitiesView(input); },
    renderAiConnection(input) { dashboard.noteAi(input); return renderAiConnectionView(input); },
    renderExplanation(input) { return renderExplanationView(input); },
    renderAction(input) { return renderActionView(input); },
  };
}
