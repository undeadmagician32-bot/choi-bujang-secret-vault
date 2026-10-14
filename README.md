# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

> **출처 한눈에 보기** — 요청의 신원·기기·경로를 확인하고 판정기·탐지 함수를 부르는 **ALEPH SDP 엔진은 수업에서 제공한 것(사용)이며 이 저장소에 코드가 없습니다.** 시작 틀(빈 뼈대·계약 문서·연습 스크립트·연습 경보 자료)도 제공받은 것이고, 판정기 규칙·탐지 규칙·접속 앱·자료실·작전실·확인표는 학생 몫입니다. 외부 라이브러리와 서비스, 코딩 도구의 도움까지 나눈 표는 아래 「12단계 설치·실행·중지·복구 안내」의 「기준과 출처」에 있습니다.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. 1단계에서는 `/data.json`에 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. (2단계에서 현재 배포와 최신 파일에서는 이 파일을 없앴습니다. 옛 커밋과 옛 배포에는 남아 있습니다. 아래 「2단계 현재 상태」와 「가상 메모 문장 검색 확인」을 보세요.) 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 2단계 현재 상태: 자료를 코드 밖으로 옮김

- 가상 메모 네 건은 Supabase 테이블 `public.archive_notes`에 있습니다. 이 저장소의 최신 파일에는 메모 본문이 없습니다. 옛 커밋에는 있습니다. 테이블을 만드는 SQL은 메모 본문을 담고 있어 저장소에 올리지 않았습니다.
- 화면(`/`)은 `/api/notes`를 호출해 카드를 그립니다. 서버 함수 `api/notes.js`만 환경변수 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 읽고, 메모의 `title`과 `content`만 돌려줍니다.
- 두 환경변수는 Vercel 프로젝트의 환경변수(Secret)에만 있습니다. 코드, Git, 브라우저 파일, 응답, 로그에 넣지 않습니다. 오류 로그에는 고정 코드만 남깁니다.
- 테이블은 행 수준 보안(RLS)을 켜고 `anon`과 `authenticated`의 권한을 모두 회수했습니다. 공개 키로는 자료를 읽을 수 없어야 합니다.
- 현재 배포에서는 `/data.json`이 배포되지 않습니다. 빌드가 `public/data.json`을 만들지 않고, 남아 있으면 지웁니다. 옛 배포와 옛 커밋에는 남아 있습니다. 아래 「가상 메모 문장 검색 확인」을 보세요.
- 로컬에서 화면 파일만 만들 때는 `npm run build -- --local`을 씁니다. `/api/notes`는 환경변수와 Supabase가 있어야 응답하고, 환경변수를 바꾸면 다시 배포해야 반영됩니다.

### 2단계 당시의 약점 (일부는 3단계에서 해결, 아래 「3단계 현재 상태」 참고)

- 2단계 당시 `/api/notes`는 공개 주소였습니다. 3단계에서 로그인 토큰 검사를 추가했습니다.
- 함수에 호출 횟수 제한이 없습니다. (3단계에도 아직 없습니다.)
- 점검 파일과 `step`이 1에 묶여 있던 문제는 3단계 저장점에서 풀었습니다. `scripts/deployment-identity.mjs`는 이제 `aleph.config.json`의 단계(1~12)를 그대로 씁니다.

## 가상 메모 문장 검색 확인

가상 메모 문장이 지금 배포된 정적 파일과 GitHub 최신 파일에 남아 있지 않은지 확인하는 절차입니다. 메모 본문 네 건은 모두 「실습용」으로 시작하는 같은 꼴의 문장입니다. 이 문서가 검색에 스스로 걸리지 않도록 검색어는 정규식 `실습용 가[상]`으로 적습니다. 브라우저 찾기(Ctrl+F)에서는 「실습용 가」를 쓰고 이어서 「상」을 붙여 찾습니다.

### 확인 절차

1. **현재 배포 파일** (시크릿 창, 로그인 없이)
   - `/`의 페이지 소스(`view-source:`)에서 검색어를 찾습니다. 나오지 않아야 합니다.
   - `/data.json`은 404여야 합니다.
   - `/aleph.json`에서 검색어를 찾습니다. 나오지 않아야 합니다. 확인 표시 `SAMPLE_NOTE_1`은 이 파일에 들어 있습니다. 확인 표시는 메모 문장이 아닙니다.
   - `/api/notes`는 2단계에서는 메모를 돌려주는 것이 정상이었습니다. 3단계부터는 로그인 없이 열면 401이어야 합니다. 이 결과는 정적 파일 검색과 따로 봅니다.
2. **GitHub 최신 파일**: 저장소 화면에서 `/`를 눌러 검색창을 열고 정규식 검색 `/실습용 가[상]/`을 실행합니다. 기본 브랜치만 검색되고 색인이 늦을 수 있으니, 내 컴퓨터에 clone이 있으면 `git grep -nE "실습용 가[상]" HEAD`도 함께 씁니다. 결과가 없어야 합니다.
3. **이 절차가 확인하지 못하는 것**: 옛 커밋과 옛 배포는 위 검색에 잡히지 않습니다. 아래 「옛 노출」을 따로 봅니다.

### 검색 결과 (2026-10-06, 확인 기준 커밋 `0c285dc`)

| 대상 | 방법 | 결과 |
|---|---|---|
| GitHub 최신 파일 | 텍스트 파일 41개를 직접 받아 검색 (`package-lock.json` 제외) | 메모 문장 없음. 확인 표시 `SAMPLE_NOTE`는 `aleph.config.json`과 `test/r5.test.mjs`에 있음 (메모 문장 아님) |
| 현재 배포 `/` | 페이지 소스 검색 | 메모 문장 없음 |
| 현재 배포 `/data.json` | 로그인 없이 요청 | 404 |
| 현재 배포 `/aleph.json` | 필드 확인과 검색 | 필드는 `schema`, `step`, `repoUrl`, `commit`, `publicAppUrl`, `judgeIssuer`, `sampleMarker`뿐. 메모 문장 없음 |
| 현재 배포 `/api/notes` | 로그인 없이 요청 | (2단계 당시) 메모 네 건을 돌려줌. 3단계에서 401로 막음 |

위 결과는 현재 배포와 최신 파일에 대한 것입니다. 과거 노출이 없어졌다는 뜻이 아닙니다.

### 옛 노출 (해소되지 않음)

- 첫 커밋 `8e3e791`의 `data.json`과 `public/data.json`에 메모 문장이 그대로 있습니다. 공개 저장소 기록에 남아 있고, 두 파일 모두 로그인 없이 읽히는 것을 확인했습니다.
- 첫 배포의 주소에서 `/data.json`이 지금도 열립니다. 로그인 없이 확인했습니다.
- 같은 저장소로 만든 별도 Vercel 프로젝트 하나가 첫 커밋 상태로 남아 있고, 그 프로젝트의 `/data.json`도 열립니다. 로그인 없이 확인했습니다.
- 2단계 작업 중 만든 중간 배포 중 `data.json`을 복사하던 빌드로 만든 것(`d403f61`, `3cc791d`, `1fcc918`)도 같은 이유로 열릴 수 있습니다. 이 셋은 확인하지 않았습니다.
- 그래서 과거 노출은 해소됐다고 쓰지 않습니다. 옛 커밋과 옛 배포가 남아 있는 한 해소되지 않습니다. 해소하려면 옛 배포와 별도 프로젝트를 Vercel에서 지우고, 저장소 기록에서 메모를 없애야 합니다(기록 다시 쓰기 또는 새 저장소). 그렇게 해도 이미 복사된 포크, 캐시, 다른 사람의 clone은 되돌릴 수 없습니다.
- 이 메모는 가상 자료라 실제 피해는 없습니다. 실제 자료였다면 이미 노출된 것으로 보고 자료와 비밀값을 새것으로 바꿔야 합니다.

### 공개 API의 남은 약점 (2단계 당시 기록, 3단계에서 로그인 검사를 추가함)

- 2단계 당시 `/api/notes`에는 로그인, 허용 경로, 호출 횟수 제한이 없었습니다. 2026-10-06에 로그인 없이 호출해서 200과 메모 네 건을 확인했습니다.
- 비밀 키는 서버 안에만 있고, 응답과 화면에서는 키처럼 보이는 값을 찾지 못했습니다. 다만 이것이 접근 자체를 막아 주지는 않습니다.
- 응답은 `no-store`이고 GET 외의 요청은 405입니다. 오류 응답과 로그에는 고정 코드만 남깁니다.
- 공개(anon) 키로 읽는 요청이 거부되는지는 직접 시험하지 않았습니다. 권한을 모두 회수하는 SQL의 확인 결과가 근거이고, 실제 판정은 심판이 확인합니다.
- 접근 제어는 3단계에서 로그인 검사부터 추가했습니다.

## 2단계 저장점 (당시 기록)

- 저장점: 2단계 「자료를 코드 밖으로 옮깁니다」. 기준 커밋은 `5df3bb8`(이 저장점 커밋 직전)입니다.
- 지금 작동하는 기능
  1. 화면(`/`)이 `/api/notes`를 호출해 가상 메모 카드 네 개를 그립니다.
  2. 서버 함수 `api/notes.js`가 서버 전용 환경변수로 Supabase 테이블 `archive_notes`에서 `title`과 `content`만 읽어 돌려줍니다.
  3. 현재 배포에서 `/data.json`은 404이고, `public/aleph.json`은 빌드가 생성합니다.
  4. 테이블은 RLS를 켜고 `anon`·`authenticated` 권한을 모두 회수했습니다(SQL 확인 결과 기준).
  5. 접근 제어는 아직 없습니다. 위 「알려진 약점」과 「공개 API의 남은 약점」을 보세요.
- 다시 실행하는 방법
  - 화면 파일만 만들 때: `npm run build -- --local` (배포나 심판 접수를 증명하지 않습니다)
  - 시험: `npm run test:r5`, `npm run test:package`
  - 배포 확인: 시크릿 창에서 `/`, `/data.json`, `/api/notes`, `/aleph.json`을 엽니다. 메모 문장 검색은 「가상 메모 문장 검색 확인」을 따릅니다.
  - 제출 묶음: 내 컴퓨터에 clone한 저장소에서 `bundle-notes.json`에 이번 단계에서 한 일을 세 줄로 적은 뒤 `npm run bundle`을 실행합니다. `bundle-notes.json`과 `artifacts/submission.json`은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `repoUrl`과 `publicAppUrl`은 자리표시자를 실제 저장소 주소와 실제 배포 주소로 바꿨습니다.
  - `step`은 1로 둡니다. `scripts/deployment-identity.mjs`가 1만 허용하고 `src/attack-check.mjs`가 1단계 점검만 구현하고 있어서, 2단계 점검을 구현할 때 함께 바꿉니다.
  - `identityProvider`는 null, `allowedRoutes`는 빈 배열, `originalApiUrl`과 `restoreRoute`는 null입니다. 3단계 이후 항목이라 비워 둡니다. `judgeIssuer`는 바꾸지 않았습니다.
- 아직 하지 않은 것
  - `npm run bundle`은 이 저장점을 만들 때 실행하지 않았습니다(미실행).
  - `src/attack-check.mjs`는 1단계 점검 그대로라서 `/data.json`만 요청합니다. 2단계 점검(`/api/notes` 등)은 구현하지 않았습니다.

## 3단계 현재 상태: 진짜 로그인

- 로그인은 Supabase Auth의 이메일·비밀번호입니다. `public/index.html`이 공식 `@supabase/supabase-js`(2.117.2, `esm.sh`)로 로그인·로그아웃하고, 비밀번호와 토큰은 SDK가 다룹니다. 화면 코드에는 공개용 Project URL과 publishable key만 있습니다.
- 서버 함수는 요청의 `Authorization` 토큰을 `src/verify-login.mjs`(시작 틀 도우미, 수정하지 않음)로 검사합니다. 토큰이 없거나 검사에 실패하면 자료 없이 401로 거부합니다. 브라우저가 보낸 `userId`·`role` 같은 값은 쓰지 않고, 서버가 확인한 사용자 ID만 씁니다.
- `/api/notes`(가상 메모)는 로그인해야 읽힙니다.
- 로그인한 사용자는 자신의 메모를 추가·수정·삭제하는 화면과 API를 씁니다. 메모는 Supabase 테이블 `public.memos`(`docs/MEMOS_TABLE.sql`, RLS를 켜고 `anon`·`authenticated` 권한 회수)에 있고, 서버 함수만 서버 전용 키로 읽고 씁니다.

| 경로 | 동작 |
|---|---|
| `GET /api/memos` | 로그인한 사용자의 메모 배열 |
| `POST /api/memos` | `{id?, title, body}` → 201 `{id}`. `owner_id`는 서버가 확인한 사용자 ID로 저장. 이미 있는 id는 409 |
| `GET /api/memos/:id` | `{id, title, body}`, 없으면 404 |
| `PUT /api/memos/:id` | `{title, body}`로 고침 → `{id}` |
| `DELETE /api/memos/:id` | 지움 → `{id}`. 지운 뒤 GET은 404 |

- `aleph.config.json`: `step` 3, `identityProvider`(Supabase 발급자 `…/auth/v1`, 대상 `authenticated`, 공개키 주소 `…/.well-known/jwks.json`, 비밀 키 없음), `allowedRoutes`에 위 다섯 경로를 `"METHOD /경로"` 꼴로 적었습니다. `originalApiUrl`과 `restoreRoute`는 5단계 이후 항목이라 null입니다.

### 3단계 당시의 약점 (소유자 검사는 4단계에서 해결, 아래 「4단계 현재 상태」 참고)

- 3단계 당시 `GET`·`PUT`·`DELETE /api/memos/:id`는 로그인만 확인하고 `owner_id`를 비교하지 않아서, 로그인한 B가 A의 메모 id를 알면 읽고 고치고 지울 수 있었습니다(가짜 DB 시험에서 읽기 200, 수정 200 확인). 4단계에서 고쳤습니다.
- 허용 경로 검사(`allowedRoutes`는 기록일 뿐 서버가 강제하지 않음)와 호출 횟수 제한은 여전히 없습니다.
- 옛 커밋과 옛 배포의 `/data.json` 노출은 여전히 해소되지 않았습니다(위 「옛 노출」).

## 3단계 저장점 (당시 기록)

- 저장점: 3단계 「진짜 로그인을 붙입니다」.
- 지금 작동하는 기능
  1. 이메일·비밀번호로 로그인·로그아웃하고, 실패하면 이유를 화면에 보여 줍니다.
  2. `/api/notes`는 서버가 토큰을 검사해 통과해야만 가상 메모를 돌려줍니다.
  3. 로그인한 사용자가 메모를 추가·수정·삭제하고, 서버가 확인한 사용자 ID를 `owner_id`로 저장합니다.
  4. 로그인 없는 요청과 위조 토큰은 모든 메모 경로에서 401입니다.
  5. 소유자 검사는 아직 없습니다. 위 「알려진 약점」을 보세요.
- 다시 실행하는 방법
  - 화면 파일만 만들 때: `npm run build -- --local`
  - 시험: `npm run test:r5`, `npm run test:package`
  - 배포 확인: 시크릿 창에서 `/`는 자료 없이 로그인 폼만, `/api/notes`와 `/api/memos`는 401이어야 합니다. A 계정으로 로그인하면 가상 메모와 「내 메모」가 보여야 합니다.
  - 제출 묶음: `bundle-notes.json`에 이번 단계에서 한 일을 적은 뒤 `npm run bundle`을 실행합니다. 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조
  - `step`을 3으로 올렸습니다. `scripts/deployment-identity.mjs`가 1~12를 허용하게 고쳤고 `test/r5.test.mjs`도 함께 바꿨습니다.
  - `src/attack-check.mjs`는 3단계 점검으로 바꿨습니다. 배포된 주소에 실제로 요청을 보내 상태 코드만 기록합니다: `/data.json`, 로그인 없는 `/api/notes`와 메모 다섯 요청, 위조 토큰 두 요청, 모두 8건. 메모 추가 점검은 본문을 비워 보내서 거부되지 않아도 메모가 만들어지지 않습니다. 이 결과는 학생의 자기 점검이며 심판의 판정이 아닙니다.
  - `src/decider.mjs`의 `RULE_IDS`는 시작 틀의 `starter.deny` 하나뿐입니다. 6단계 이후에 구현합니다.
  - `judgeIssuer`는 바꾸지 않았습니다.
- 아직 하지 않은 것
  - B 계정으로 A의 메모에 접근하는 점검은 하지 않았습니다(미실행, 4단계에서 기록).
  - 실제 Supabase와 두 계정으로 한 시험은 A 한 계정의 화면 동작뿐입니다.

## 4단계 현재 상태: 로그인해도 내 자료만 보이게

- 서버가 토큰으로 확인한 사용자 ID와 DB의 `owner_id`가 같은 행만 다룹니다. URL이나 본문의 `owner_id`는 믿지 않습니다.
- `GET`·`PUT`·`DELETE /api/memos/:id`는 비교를 DB 쿼리 안(`id`와 `owner_id` 조건)에서 한 번에 합니다. 남의 메모와 없는 메모는 같은 404 `NOT_FOUND`로 답해서 메모가 있는지조차 알려 주지 않습니다. 한 건 GET 응답은 `{id, title, body}`이고 수정 본문은 `{title, body}`입니다.
- `PUT`은 기존 행의 소유자가 본인일 때만 고쳐지고, 새 행의 `owner_id`도 확인된 사용자 ID로 고정합니다. 본문에 본인이 아닌 `owner_id`가 있으면 소유자 변경 시도로 보고 403 `OWNER_CHANGE_FORBIDDEN`으로 거부합니다.
- `POST`는 본문의 `owner_id`를 무시하고 확인된 사용자 ID로 저장합니다. 목록 `GET /api/memos`는 로그인한 사용자 것만 돌려줍니다. `allowedRoutes`는 3단계와 같은 다섯 경로이며 실제 메서드·경로와 일치합니다.
- DB: 학습 DB의 `public.memos`에서 기존 메모 세 건을 A 소유로 연결하고 B 소유의 시험 메모 한 건을 만들었습니다(이메일로 `auth.users`에서 ID를 찾는 일회성 SQL이라 저장소에 올리지 않았습니다). 이어서 `docs/MEMOS_RLS.sql`을 적용했습니다. `PUBLIC`·`anon`·`authenticated`의 권한을 모두 회수하고 RLS를 켠 뒤, `authenticated`에만 SELECT·INSERT·UPDATE·DELETE를 주었고, 정책 네 개는 모두 `auth.uid() = owner_id`일 때만 허용합니다(SELECT·DELETE는 기존 행 USING, INSERT는 새 행 WITH CHECK, UPDATE는 둘 다).
- 앱 API는 서버 전용 키로 DB에 접근해서 RLS를 건너뜁니다. 그래서 앱에서 상대 행이 거부되는 것은 위 코드의 소유자 검사 덕분이고, RLS와 권한은 공개 키와 로그인 토큰으로 DB에 직접 접근하는 경우를 막는 두 번째 방어선입니다. 같은 이유로 `authenticated`에 권한을 준 만큼, 로그인한 사용자가 자기 행에 한해 DB에 직접 접근할 수 있게 열렸습니다. 이 직접 접근은 5단계에서 다시 닫았습니다.

### 알려진 약점

- 허용 경로 검사(`allowedRoutes`는 기록일 뿐 서버가 강제하지 않음)와 호출 횟수 제한이 없습니다.
- 남의 메모 id로 `POST`하면 409 `ID_EXISTS`가 돌아와서, 그 id가 이미 있다는 사실(내용은 아님)이 드러납니다.
- 옛 커밋과 옛 배포의 `/data.json` 노출은 여전히 해소되지 않았습니다(위 「옛 노출」).

## 4단계 저장점

- 저장점: 4단계 「로그인해도 내 자료만 보이게 합니다」. 소유자 검사 코드는 커밋 `f5dd12e`에 있습니다.
- 지금 작동하는 기능
  1. 로그인한 A와 B는 각자 자기 메모를 읽고 추가·수정·삭제합니다.
  2. 상대 메모를 읽거나 고치거나 지우면 404이고, 본문으로 소유자를 바꾸려 하면 403입니다.
  3. `owner_id`는 서버가 확인한 사용자 ID로만 저장합니다.
  4. `public.memos`는 RLS와 최소 권한(authenticated에 4개 권한, 소유자 정책 4개)을 갖습니다.
  5. 3단계 기능(로그인·로그아웃, `/api/notes`의 토큰 검사, 무로그인·위조 토큰 401)은 그대로입니다.
- 다시 실행하는 방법
  - 화면 파일만 만들 때: `npm run build -- --local`
  - 시험: `npm run test:r5`, `npm run test:package`
  - 배포 확인: A로 로그인하면 자기 메모만, B로 로그인하면 B의 메모만 보입니다. 로그인한 B가 A의 메모 id로 `/api/memos/<id>`를 요청하면 404여야 합니다.
  - DB 권한 확인: `docs/MEMOS_RLS.sql`의 확인 쿼리(`role_table_grants`, `has_table_privilege`, `pg_policies`)를 하나씩 실행합니다.
  - 제출 묶음: `bundle-notes.json`에 이번 단계에서 한 일을 적은 뒤 `npm run bundle`을 실행합니다. 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 4로 올렸습니다. `scripts/deployment-identity.mjs`는 1~12를 허용해서 바꾸지 않았습니다.
  - `identityProvider`와 `allowedRoutes`는 3단계와 같고 구현과 일치합니다. `originalApiUrl`과 `restoreRoute`는 5단계 이후 항목이라 null입니다. `judgeIssuer`는 바꾸지 않았습니다.
  - `src/attack-check.mjs`는 4단계 점검 10건(3단계 8건 + 로그인 없이 B의 시험 메모 id를 읽기, 본문에 `owner_id`를 넣어 고치기)입니다. 전부 로그인 없는 요청(또는 위조 토큰 요청)이라 401만 확인합니다.
  - `src/decider.mjs`의 `RULE_IDS`는 시작 틀의 `starter.deny` 하나뿐입니다. 6단계 이후에 구현합니다.
- 확인한 것과 하지 않은 것
  - 가짜 DB·가짜 토큰으로 A/B의 소유자 검사 시험을 했고 모두 통과했습니다(임시 시험 파일은 저장소에 두지 않았습니다).
  - 학생이 배포 뒤 A·B 계정으로 앱을 확인했다고 알려 왔습니다(제가 화면을 직접 보지는 못했습니다).
  - `docs/MEMOS_RLS.sql` 적용 뒤 `role_table_grants`, `has_table_privilege`, `pg_policies` 결과를 캡처로 확인했습니다. `authenticated`는 4개 권한만 `true`이고 `anon`은 모두 `false`이며 정책은 네 개였습니다.
  - RLS 동작 시험(역할을 바꿔 상대 행 접근을 확인하는 SQL)은 학생이 실행했다고 알려 왔지만 결과 표는 보지 못했습니다.
  - **로그인한 A·B 토큰으로 상대 메모에 접근하는 점검은 `attack-check.mjs`에 넣지 못했습니다(미실행).** 토큰을 코드나 제출 묶음에 둘 수 없어서, 이 점검은 로그인 없이는 할 수 없는 부분만 기록합니다.

## 5단계 현재 상태: 자료 요청을 서버 한곳으로

- 브라우저 코드(`public/index.html`)는 메모 자료를 Supabase에서 직접 읽거나 고치는 곳이 없습니다. 자료는 모두 서버 함수(`/api/notes`, `/api/memos`, `/api/memos/:id`)를 부릅니다.
- **화면 코드에는 Supabase 키가 없습니다.** 저장점 때는 화면이 공개 키로 Supabase에 직접 로그인했는데, 심판 점검 「화면 코드에 공개 키가 없다」에 걸려서 로그인·세션 갱신·로그아웃을 서버 함수로 옮겼습니다. 서버가 같은 공식 SDK(`signInWithPassword`, `refreshSession`, `auth.admin.signOut`)를 부르고, 비밀번호와 토큰은 서버가 만들지도 저장하지도 않습니다(Supabase가 발급).

| 경로 | 동작 |
|---|---|
| `POST /api/auth/login` | `{email, password}` → `{access_token, refresh_token, expires_at, email}`. 실패하면 Supabase가 알려 준 이유를 `message`로 돌려줌 |
| `POST /api/auth/refresh` | `{refresh_token}` → 새 세션. 만료·취소된 토큰이면 401 |
| `POST /api/auth/logout` | `Authorization: Bearer` 토큰의 로그인 세션을 서버 전용 키로 취소. 토큰이 없으면 401 |

- (11단계에서 바뀜: 지금은 탭 메모리에만 두고 저장소에 쓰지 않습니다. 아래 「11단계 현재 상태」 참고) 화면은 서버가 돌려준 세션을 이 브라우저의 `localStorage`에 보관하고(비밀번호는 보관하지 않음), 만료 1분 전이면 `/api/auth/refresh`로 갱신한 뒤 자료를 요청합니다.
- **Vercel 환경변수에 `SUPABASE_PUBLISHABLE_KEY`가 필요합니다.** 로그인 도구용 공개 키이며, 기존 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`와 같은 곳에 둡니다. 없으면 로그인이 "서버의 로그인 설정이 아직 없습니다"로 실패하고, 환경변수를 바꾼 뒤에는 다시 배포해야 반영됩니다.
- 서버 함수의 로그인 검사, 소유자 검사, 서버 전용 설정(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`)은 그대로입니다.
- DB: 학습 DB의 `public.memos`에서 `PUBLIC`·`anon`·`authenticated`의 직접 권한을 모두 회수했습니다(`docs/MEMOS_REVOKE.sql`). 서버 전용 키가 쓰는 `service_role`은 그대로이고, RLS와 소유자 정책 네 개도 그대로 남겼습니다. 4단계에서 `authenticated`에 주었던 직접 접근은 이제 닫혀 있고, 메모는 서버 함수를 통해서만 읽고 쓸 수 있습니다.
- `aleph.config.json`의 `originalApiUrl`은 쿼리 없는 원본 자료 HTTPS 경로 `https://vfsfpmggzswszqljxznx.supabase.co/rest/v1/memos`입니다(메모 테이블을 DB에서 직접 읽는 주소). 공개 키로 이 주소에 직접 요청하면 거부되어야 하고, 심판이 공개 키로 확인합니다.
- 배포되는 `/aleph.json`에도 `allowedRoutes`(3단계부터, `"METHOD /경로"` 꼴이 하나 이상)와 `originalApiUrl`(5단계부터)이 실립니다. 빌드(`scripts/deployment-identity.mjs`)가 `aleph.config.json`의 두 값을 검사해서 `aleph.json`에 넣고, 없거나 형식이 틀리면(`allowedRoutes`가 비었거나 쿼리·중복이 있을 때, `originalApiUrl`이 http이거나 쿼리·비밀번호·조각이 붙어 있을 때) 빌드가 실패합니다. 첫 화면 응답의 보안 머리글(`X-Content-Type-Options: nosniff`)은 `vercel.json`이 이미 붙이고 있었고 배포에서 확인했습니다. 심판은 설정 파일이 아니라 이 배포 파일을 읽습니다(5단계 저장점 직후 심판이 `S05_ORIGINAL_URL_MISSING`으로 알려 와서 고쳤습니다).

### 알려진 약점

- 허용 경로 검사(`allowedRoutes`는 기록일 뿐 서버가 강제하지 않음)와 호출 횟수 제한이 없습니다.
- 남의 메모 id로 `POST`하면 409 `ID_EXISTS`가 돌아와서, 그 id가 이미 있다는 사실(내용은 아님)이 드러납니다.
- `originalApiUrl`은 메모 테이블 하나만 가리킵니다. 가상 메모 테이블 `archive_notes`의 직접 경로는 이 값에 없지만, 2단계에서 `anon`·`authenticated` 권한을 모두 회수해 두었습니다(이번 단계에서 다시 확인하지는 않았습니다).
- 옛 커밋과 옛 배포의 `/data.json` 노출은 여전히 해소되지 않았습니다(위 「옛 노출」).

## 5단계 저장점

- 저장점: 5단계 「자료 요청을 서버 한곳으로 모읍니다」.
- 지금 작동하는 기능
  1. 화면은 키 없이 서버 함수로만 로그인하고 자료를 요청합니다(저장점 이후 수정, 위 「5단계 현재 상태」 참고).
  2. 서버 함수는 로그인 토큰과 소유자를 검사한 뒤 서버 전용 키로 DB를 읽고 씁니다. A는 자기 메모를 읽고 추가·수정·삭제합니다.
  3. `public.memos`의 직접 권한은 `PUBLIC`·`anon`·`authenticated` 모두 없고, `service_role`만 있습니다.
  4. 공개 키로 원본 자료 API(`/rest/v1/memos`)에 직접 요청하면 401(permission denied, 42501)입니다.
  5. 3·4단계 기능(로그인·로그아웃, `/api/notes`의 토큰 검사, 소유자 검사 404·403)은 그대로입니다.
- 다시 실행하는 방법
  - 화면 파일만 만들 때: `npm run build -- --local`
  - 시험: `npm run test:r5`, `npm run test:package`
  - DB 권한 확인: `docs/MEMOS_REVOKE.sql`의 확인 쿼리를 하나씩 실행합니다.
  - 화면 확인: A로 로그인해 메모를 추가·수정·삭제하고 목록을 봅니다.
  - 제출 묶음: `bundle-notes.json`에 이번 단계에서 한 일을 적은 뒤 `npm run bundle`을 실행합니다. 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 5로 올렸습니다. `scripts/deployment-identity.mjs`는 1~12를 허용해서 바꾸지 않았습니다.
  - `originalApiUrl`은 위 주소이고, `scripts/bundle.mjs`가 5단계부터 요구하는 HTTPS 주소 조건을 충족합니다.
  - `identityProvider`와 `allowedRoutes`는 4단계와 같고 구현과 일치합니다. `restoreRoute`는 null이며 저장소 안에 이 값을 설명하는 곳이 없어서 바꾸지 않았습니다. `judgeIssuer`도 바꾸지 않았습니다.
  - `src/attack-check.mjs`는 5단계 점검 13건(4단계 10건 + 토큰 없이 공개 키만으로 원본 자료 API에 직접 요청 + 첫 화면의 보안 머리글 + 첫 화면 코드에 키 없음)입니다. 전부 상태 코드와 있음·없음만 기록합니다. 저장점 때는 11건이었고, 심판 점검에 맞춰 2건을 더했습니다.
  - `src/decider.mjs`의 `RULE_IDS`는 시작 틀의 `starter.deny` 하나뿐입니다. 6단계 이후에 구현합니다.
- 확인한 것과 하지 않은 것
  - 가짜 DB·가짜 토큰으로 A의 읽기·추가·수정·삭제 흐름과 무로그인 401을 시험했고 통과했습니다(임시 시험 파일은 저장소에 두지 않았습니다).
  - 권한 회수 뒤 `role_table_grants`, `has_table_privilege`, RLS 상태를 캡처로 확인했습니다. `role_table_grants`에는 `service_role` 행만 남았고, `anon`과 `authenticated`는 4개 권한이 모두 `false`, `service_role`은 모두 `true`, `rls_on = true`였습니다.
  - 공개 키로 `/rest/v1/memos`를 요청하면 HTTP 401, `permission denied for table memos`(42501)였고 자료는 오지 않았습니다(상태 코드만 확인).
  - 학생이 권한 회수 뒤 화면에서 A의 동작이 모두 정상이라고 알려 왔습니다(제가 화면을 직접 보지는 못했습니다).
  - **로그인 토큰(`authenticated`)으로 원본 자료 API에 직접 요청하는 점검은 하지 못했습니다(미실행).** 토큰을 코드나 제출 묶음에 둘 수 없어서입니다. 이 경로가 막혀 있다는 근거는 권한 확인(`has_table_privilege`)뿐입니다.
  - 로그인한 A·B 토큰으로 서로의 메모에 접근하는 점검도 4단계 때와 같이 미실행입니다.

## 6단계 현재 상태: 등록한 기기만 자료실에 들어옵니다

- `src/decider.mjs`에 규칙 `device_registered`를 추가했습니다. `RULE_IDS`는 `['starter.deny', 'device_registered']`입니다.
- 엔진이 보낸 요청의 `deviceRegistered`가 `true`이고 읽기(`GET`)면 `allow`(이유 코드 `approved`)입니다. `false`이거나 값이 없거나 `true`가 아닌 값이면 `deny`(이유 코드 `device_not_registered`)입니다. 등록 기기의 쓰기 요청은 기존 `starter.deny`로 거부합니다.
- 요청 항목은 `docs/DECIDER_REQUEST.md` 계약에 있는 값만 씁니다. 브라우저가 보낸 기기 상태는 믿지 않습니다.
- 이 과정에는 따로 설치할 접속 프로그램이 없습니다. 미등록 기기로 실제 접속하는 공격은 심판이 맡습니다.

### 확인 순서

1. 저장소 폴더에서 `npm run decider:test`를 실행합니다.
2. 「통과 · 등록 기기의 정상 요청」이 보여야 합니다. 등록 기기(`deviceRegistered: true`)의 읽기 요청이 `allow`라는 뜻입니다.
3. 「통과 · 미등록 기기의 가상 요청」이 보여야 합니다. `deviceRegistered: false`인 요청이 `deny`이고 이유 코드가 `device_not_registered`일 때만 통과로 나옵니다.
4. 「확인 필요」가 한 줄이라도 나오거나 「판정기 연습 첫 오류」가 나오면 실패입니다.

2026-10-13에 실행한 결과는 위 두 줄이 모두 「통과」였습니다. 같은 가상 요청으로 판정기 응답을 직접 출력하면 등록 기기는 `allow approved ["device_registered"]`, 미등록 기기는 `deny device_not_registered ["device_registered"]`였습니다. 이 연습은 가상 요청이며 심판의 판정이 아닙니다.

### 아직 확인하지 못한 것

- 허용 이유 코드 `approved`는 계약 문서의 예시에서 가져왔습니다. 운영 등록부의 `allowedReasonCodes`가 저장소에 없어서 등록 여부는 확인하지 못했습니다.
- 실제 배포와 심판의 미등록 기기 점검은 실행하지 않았습니다(미실행).

## 6단계 저장점

- 저장점: 6단계 「등록한 기기만 자료실에 들어옵니다」.
- 지금 작동하는 기능
  1. 판정기는 등록 기기의 읽기 요청만 허용하고, 미등록·값 없는 기기는 `device_not_registered`로 거부합니다.
  2. 5단계까지의 기능(서버 함수 로그인, 토큰·소유자 검사, DB 직접 권한 회수)은 그대로입니다.
- 다시 실행하는 방법
  - 판정기 연습: `npm run decider:test` (위 「확인 순서」)
  - 시험: `npm run test:r5`, `npm run test:package`
  - 제출 묶음: `bundle-notes.json`에 이번 단계에서 한 일을 적은 뒤 `npm run bundle`을 실행합니다. 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 6으로 올렸습니다. `identityProvider`, `allowedRoutes`, `originalApiUrl`은 5단계와 같고 구현과 일치합니다. `restoreRoute`와 `judgeIssuer`는 바꾸지 않았습니다.
  - `src/decider.mjs`의 `RULE_IDS`는 `starter.deny`(규칙에 맞지 않는 요청의 기본 거부)와 `device_registered` 두 개이며, 둘 다 실제로 쓰입니다.
  - `src/attack-check.mjs`는 6단계에서도 5단계 점검 13건을 그대로 씁니다. 배포 주소로 보낼 수 있는 새 점검이 없고, 미등록 기기 접속은 심판이 점검합니다.

## 7단계 현재 상태: 평소와 다른 접속은 다시 확인합니다

- `src/decider.mjs`에 규칙 `step_up_required`를 추가했습니다. `RULE_IDS`는 `['starter.deny', 'device_registered', 'step_up_required']`입니다.
- 입력 검사(`readAccessContext`): 계약의 `signals`·`recentEvents`만 접속 정보로 읽고 출처를 `judge_fixture`(심판 가상 요청), `engine_none`(엔진이 정보 없음을 알림), `unverified`(없음·출처 불명·항목 추가)로 나눕니다. 지역·네트워크·시각 값은 `judge_fixture`일 때만 남기고, `unknown`·범위 밖·형식이 틀린 값은 `null`로 둡니다. 정상값으로 채우지 않습니다. 계약 밖 항목(헤더, `geo` 등)은 읽지 않으므로 위조한 클라이언트 헤더는 접속 정보가 되지 않습니다.
- 등록 기기의 읽기 요청에서 평소와 다른 시각(0~5시), 처음 보는 네트워크(`network: "unusual"`), 최근 5분 사건 10건 이상이 **모두** 맞으면 `step_up`(이유 코드 `step_up_required`)입니다. 기준값은 연습용이며 운영 기준이 아닙니다. 사건 종류는 계약에 목록이 없어 건수만 셉니다.
- 지역은 조건에 넣지 않았고 이 규칙은 `deny`(차단)를 돌려주지 않습니다. 엔진이 확인한 재인증(`stepUp.verified`)이 300초 이내면 같은 사건도 `allow`입니다.
- 기기 규칙이 먼저 적용되어 미등록 기기는 그대로 `device_not_registered`로 거부됩니다. 출처가 불명확한 신호는 이상 징후로도 쓰지 않으므로, 위조 헤더로 꾸민 이상 요청은 일반 등록 기기 규칙(`allow`)을 따릅니다.

### 확인 순서

1. 저장소 폴더에서 `npm run decider:test`를 실행합니다. 「통과」가 네 줄(등록 기기 정상 요청, 미등록 기기, 복합 이상 접속, 다시 확인한 복합 이상 접속) 나와야 합니다.
2. `npm run fixture:7`을 실행합니다. 「정상 사건: allow」, 「복합 이상 사건: step_up」이 나와야 합니다.
3. 「확인 필요」나 「첫 오류」가 나오면 실패입니다.

2026-10-13 실행 결과는 위와 같았습니다. 이 연습은 가상 요청이며 심판의 판정이 아닙니다.

### 아직 확인하지 못한 것

- 계약에는 `stepUp: {verified, authAgeSeconds}`만 있고, 같은 로그인으로 다시 로그인했는지, 확인 전 자료를 막고 새 요청을 다시 판정하는 흐름은 운영 엔진 쪽에 있어 이 저장소에 없습니다. 자료실 서버 함수(`api/`)도 판정기를 부르지 않습니다. 실제 배포에서 다시 로그인 전 차단과 새 로그인 뒤 허용은 **미실행**입니다.
- 이유 코드 `step_up_required`는 연습 시험(`scripts/decider-test.mjs`)에서 가져왔습니다. 운영 등록부의 `allowedReasonCodes`가 저장소에 없어 등록 여부는 확인하지 못했습니다.

## 7단계 저장점

- 저장점: 7단계 「평소와 다른 접속은 다시 확인합니다」.
- 지금 작동하는 기능
  1. 판정기는 출처가 확인된 가상 접속 정보만 읽고, 복합 이상 읽기는 추가 확인(`step_up`), 최근 재인증 뒤에는 허용합니다.
  2. 6단계 기기 규칙과 5단계까지의 기능(서버 함수 로그인, 토큰·소유자 검사, DB 직접 권한 회수)은 그대로입니다.
- 다시 실행하는 방법
  - 판정기 연습: `npm run decider:test`, `npm run fixture:7` (위 「확인 순서」)
  - 시험: `npm run test:r5`, `npm run test:package`
  - 제출 묶음: `bundle-notes.json`에 이번 단계에서 한 일을 적은 뒤 `npm run bundle`을 실행합니다. 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 7로 올렸습니다. `identityProvider`, `allowedRoutes`, `originalApiUrl`은 6단계와 같고 구현과 일치합니다. `restoreRoute`와 `judgeIssuer`는 바꾸지 않았습니다.
  - `RULE_IDS`의 세 규칙은 모두 실제로 쓰입니다.
  - `src/attack-check.mjs`는 7단계에서도 5단계 점검 13건을 그대로 씁니다. 배포 주소로 보낼 새 점검이 없고, 이상 접속은 심판이 점검합니다.

## 8단계 현재 상태: 자료마다 갈 수 있는 구역을 나눕니다

- 자원 ID(`src/resources.mjs`): 내 자료실 메모(`/api/memos`, `/api/memos/:id`)는 `vault.memo`, 강사 공지(`/api/notes`)는 `class.notice`입니다. 서버 함수가 응답 머리글 `X-Resource-Id`에 붙이며, 클라이언트가 보낸 값은 읽지 않습니다. 이 자료실에는 따로 만든 공지 자료가 없어, 로그인한 모두가 읽기만 하는 `/api/notes`(`archive_notes`)를 공지로 정했습니다.
- 판정기 구역 규칙(`src/decider.mjs`): `RULE_IDS`에 `route_zone`, `memo_zone`, `notice_write_zone`을 더했습니다(이전 세 규칙 유지).
  - `route_zone`: 엔진이 확인한 `subjectId`·`deviceId`가 있고, `route`가 `GET /notes/:id`, `PUT /notes/:id`, `PUT /notices/:id` 중 하나이며, 메서드·서비스·`path`가 정확히 맞고 쿼리가 없을 때만 다음 규칙으로 갑니다. 나머지는 `route_not_allowed`(사용자·기기 없음은 `subject_not_verified`)로 거부합니다. 경로 마지막 칸은 자료 ID만 받고 `export` 같은 기능 경로는 없습니다.
  - `memo_zone`: 등록 기기의 메모 읽기·수정은 `allow`입니다. 읽기에는 7단계 추가 확인이 먼저 적용됩니다.
  - `notice_write_zone`: 공지 수정은 `instructor_not_verified`로 거부합니다. 계약에 엔진이 확인한 역할이 없기 때문입니다.
  - 엔진 쪽 경로 이름 `/notes`는 연습 요청(`fixture:7`)을 따랐고 메모를 뜻합니다. `/notices`는 제가 정한 이름이라 운영 엔진과 다를 수 있습니다.
- 자료 API 재대조: 메모 API는 4단계 소유자 비교(`owner_id` = 검증된 사용자)를 유지하고, 404로 거부할 때 `MEMO_DENIED not_owner|not_found`만 로그에 남깁니다(응답은 같은 404). 공지 API의 쓰기 요청은 로그인 검사 뒤 저장된 강사 권한을 확인합니다. 강사 권한을 저장한 곳이 아직 없어 누구의 수정도 403(`NOTICE_DENIED instructor_not_verified`)이고, 비로그인은 401입니다. 화면 메뉴나 본문·쿼리의 `role`은 읽지 않습니다.

### 확인 순서

1. `npm run decider:test`: 「통과」 네 줄. `npm run fixture:7`: 「정상 사건: allow」, 「복합 이상 사건: step_up」.
2. `npm run test:r5`(pass 2), `npm run test:package`(pass 3).
3. 배포 뒤 B로 로그인해 개발자 도구 콘솔에서 A 메모 주소로 `fetch`를 보내면 404여야 합니다. 200이나 메모 내용이 나오면 실패입니다. 네트워크 탭에서 `/api/memos`와 `/api/notes`의 `X-Resource-Id`가 서로 달라야 합니다.

2026-10-13에 가짜 DB로 서버 함수를 직접 부른 결과, A 자기 메모 200, B의 A 메모 읽기·수정·삭제 404(쿼리·본문에 `role=instructor`를 넣어도 같음), 학생 공지 수정 403, 비로그인 공지 수정 401이었습니다. 판정기 연습에서는 A 메모 읽기·수정 `allow`, 공지 수정 `deny`, 쿼리·`/notes/:id/export`·DELETE는 `route_not_allowed`였습니다. 가상 요청이며 심판의 판정이 아닙니다.

### 아직 확인하지 못한 것

- 판정 계약에 메모 주인 항목이 없어 판정기 혼자서는 B의 A 메모를 거부하지 못합니다. 이 거부는 서버 함수의 소유자 검사가 맡습니다.
- 강사 권한 저장소가 없어 강사의 공지 수정은 구현하지 않았습니다. 새 이유 코드(`route_not_allowed`, `subject_not_verified`, `instructor_not_verified`)의 운영 등록부 등록 여부는 확인하지 못했습니다.
- 실제 배포에서 A·B 계정으로 한 타인 구역 점검은 미실행입니다(토큰을 코드에 둘 수 없음).

## 8단계 저장점

- 저장점: 8단계 「자료마다 갈 수 있는 구역을 나눕니다」.
- 지금 작동하는 기능
  1. 메모와 공지는 서로 다른 자원 ID로 구분되고, 판정기는 정확히 맞는 구역 경로만 다음 규칙으로 넘깁니다.
  2. 자료 API는 검증된 사용자와 저장된 소유자·강사 권한을 다시 대조하고 짧은 거부 사유를 남깁니다.
  3. 7단계 추가 확인, 6단계 기기 규칙, 5단계까지의 기능은 그대로입니다.
- 다시 실행하는 방법: 위 「확인 순서」. 제출 묶음은 `bundle-notes.json`을 이번 단계 내용으로 고친 뒤 `npm run bundle`을 실행하며, 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 8로 올렸습니다. `identityProvider`, `allowedRoutes`, `originalApiUrl`은 7단계와 같고 구현과 일치합니다. `restoreRoute`와 `judgeIssuer`는 바꾸지 않았습니다.
  - `RULE_IDS`의 여섯 규칙은 모두 코드에 있습니다. `starter.deny`는 구역 표에 맞았지만 처리 규칙이 없는 요청의 마지막 거부입니다.
  - `src/attack-check.mjs`는 8단계에서도 5단계 점검 13건을 그대로 씁니다. 공지 쓰기 401·403 점검은 새 배포가 끝나야 의미가 있어 넣지 않았습니다(미실행).

## 9단계 현재 상태: 도플갱어를 찾고 권한을 거둡니다

- 사건 입력 정리(`src/detect.mjs`의 `readDetectionEvents`): `docs/DETECT_EVENTS.md` 계약의 `{at, method, identity: {sub}}`만 받아 `{subject, method, at}`로 옮깁니다. 계약에 없는 항목(메모 본문·토큰·이름 등)이 붙었거나, 가명이 영문·숫자·`_`·`-`가 아니거나, 시각이 UTC ISO가 아닌 사건은 고쳐 쓰지 않고 버리며 건수만 셉니다. 사건에 기기·판정 항목은 없어 읽지 않습니다.
- 다량 조회 규칙(`detect()`): 같은 가명 사용자의 GET이 어느 10분 구간에서든 120건을 넘을 때만 `{action: 'propose_revocation', reasonCode: 'burst_read', subject}`, 나머지는 `{action: 'observe'}`입니다. 정확히 120건, 다른 사용자 합산, 10분 밖 사건, GET이 아닌 요청은 세지 않습니다. 탐지 사건에 네트워크·지역이 없어 이 규칙은 그것을 보지 않으며, 평소와 다른 네트워크와 많은 읽기의 조합은 7단계 판정기(`step_up`)가 계속 맡습니다.
- 회수 제안(`proposeRevocation(detection, verified)`): `detect()` 응답과 판정기의 allow/deny/step_up 응답은 그대로 두고 별도 결과 한 건을 만듭니다. 기기는 엔진이 확인한 `{subjectId, deviceId}` 한 쌍(판정기 계약 형식, 16자리 소문자 16진수)으로만 받고, 탐지된 가명과 `subjectId`가 같을 때만 `{action: 'propose_revocation', reasonCode: 'burst_read', target: {subjectId, deviceId}}`를 돌려줍니다. 그 밖에는 `null`입니다. 회수 API 호출, 기기 권한 변경, 시각 기록은 하지 않습니다.

### 확인 순서

1. `npm run detect:test`: 「통과」 여섯 줄. 「정상 조회 30건」이나 「10분 안에 120건」이 「확인 필요」면 실패입니다.
2. `npm run decider:test`(「통과」 네 줄), `npm run fixture:7`(allow, step_up), `npm run test:r5`(pass 2), `npm run test:package`(pass 3).

2026-10-13에 가상 사건으로 함수를 직접 부른 결과, 의심 200건은 `learner_fixture` 기기 한 개와 `burst_read`가 담긴 회수 제안, 정상 30건·정확히 120건은 제안 없음이었습니다. 다른 사용자의 기기, 형식이 틀린 기기 ID, 기기 두 개, 계약 밖 항목이 붙은 입력은 모두 제안 없음이었고, 메모 본문·토큰·이름을 섞은 사건은 버려져 결과에 나오지 않았습니다. 가상 사건이며 심판의 판정이 아닙니다.

### 아직 확인하지 못한 것

- 운영 반 엔진이 검증한 사건을 `detect()`에 전달하는 경로와 회수 제안을 집행하는 경로는 연결·시험하지 않았습니다. 실제 접속 회수와 회수 시간은 심판이 확인합니다.
- 탐지 사건에 기기가 없어, 가명 사용자와 기기 한 쌍을 잇는 일은 엔진의 몫으로 두었습니다. `burst_read`가 운영 등록부에 있는지는 확인하지 못했습니다.

## 9단계 저장점

- 저장점: 9단계 「도플갱어를 찾고 권한을 거둡니다」.
- 지금 작동하는 기능
  1. 탐지 함수는 가상 사건에서 가명 사용자·요청 종류·시각만 읽고 비밀값이 섞인 사건은 버립니다.
  2. 같은 사용자의 10분 안 조회가 120건을 넘으면 회수를 제안하고, 확인된 기기 한 개를 대상으로 하는 별도 회수 제안을 만듭니다.
  3. 8단계 구역 규칙, 7단계 추가 확인, 6단계 기기 규칙, 5단계까지의 기능은 그대로입니다.
- 다시 실행하는 방법: 위 「확인 순서」. 제출 묶음은 `bundle-notes.json`을 이번 단계 내용으로 고친 뒤 `npm run bundle`을 실행하며, 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 9로 올렸습니다. `identityProvider`, `allowedRoutes`, `originalApiUrl`은 8단계와 같고 구현과 일치합니다. `restoreRoute`와 `judgeIssuer`는 바꾸지 않았습니다.
  - `src/decider.mjs`는 바꾸지 않았고 `RULE_IDS`의 여섯 규칙은 모두 코드에 있습니다. 탐지 규칙은 판정기 규칙이 아니라 `src/detect.mjs`에 있습니다.
  - `src/attack-check.mjs`는 9단계에서도 5단계 점검 13건을 그대로 씁니다. 접속 회수는 배포 주소로 보낼 수 있는 점검이 없어 심판이 점검합니다(미실행).

## 보너스 xdr-01 저장점: 무차별 로그인 공격 탐지

- 대상: `xdr/fixtures/brute-force.json`의 연습 경보 28건(수업용 가상 Wazuh 모양). 근거는 MITRE ATT&CK T1110입니다.
- 지금 작동하는 기능
  1. `xdr/brute-force/decide.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상 block, 0.5 이상 alert, 그 아래 record입니다. 다른 파일을 불러오지 않고 파일을 읽거나 쓰지 않습니다. 패턴 두 개(같은 주소의 짧은 시간 로그인 실패 연속, 여러 계정에 같은 비밀번호 대입)는 `patterns.json`과 같은 내용을 파일 맨 위 상수로 가집니다.
  2. `xdr/brute-force/read-alerts.mjs`: 확인용 읽기 모듈입니다. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 문자열은 가립니다. `decide.mjs`는 불러오지 않습니다.
  3. `xdr/brute-force/respond.mjs`: block 결과만 출발 주소 기준의 거부 규칙(만료 시각·근거 경보 번호 포함)으로 `xdr/brute-force/deny-rules.json`에 저장하고, 알림을 `xdr/alerts.log`에 한 줄씩 쌓습니다. `src/decider.mjs`에는 연결하지 않았습니다.
- 다시 실행하는 방법
  - 판정 결과: `npm run xdr:run -- brute-force` (`xdr/brute-force/result.json` 갱신)
  - 읽기 확인: `node xdr/brute-force/read-alerts.mjs` (경보 건수와 뽑은 줄 수가 같아야 함)
  - 규칙·알림 만들기: `node xdr/brute-force/respond.mjs` (`deny-rules.json`, `alerts.log`는 실행마다 달라져서 커밋하지 않음)
- 확인한 것: 위 `npm run xdr:run` 결과가 block 10, alert 9, record 9였고, `respond.mjs`는 임시 폴더에서 같은 경보를 다시 흘려 명확한 공격 10건만 막히고 나머지 18건은 통과하는 것을 확인했습니다.
- 하지 않은 것
  - 거부 규칙은 `src/decider.mjs`에 연결하지 않았습니다. 판정기 요청에는 출발 주소 항목이 없고, 새 이유 코드는 운영 등록부 등록이 필요합니다. 실제 접속 차단이라고 보지 않습니다.
  - 건수 구간·확신도 가중치·규칙 만료 1시간은 MITRE에 없는 연습용 값입니다. 심판의 판정이 아닙니다.
  - `npm run bundle`은 실행하지 않았습니다(미실행).

## 보너스 xdr-02 저장점: 웹 주입 공격 탐지

- 대상: `xdr/fixtures/web-injection.json`의 연습 경보 26건(수업용 가상 Wazuh 모양). 근거는 MITRE ATT&CK T1190(외부 공개 앱 악용)이고, 신호는 요청 인자 안의 SQL 구문·스크립트 태그·`../` 반복입니다.
- 지금 작동하는 기능
  1. `xdr/web-injection/decide.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상 block, 0.5 이상 alert, 그 아래 record입니다. 다른 파일을 불러오지 않고 파일을 읽거나 쓰지 않습니다. 패턴 네 개는 `patterns.json`과 같은 내용을 파일 맨 위 상수로 가집니다. 패턴마다 근거 한 줄이 있습니다.
  2. `xdr/web-injection/read-alerts.mjs`: 확인용 읽기 모듈입니다. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 문자열은 가립니다. `decide.mjs`는 불러오지 않습니다.
  3. `xdr/web-injection/respond.mjs`: block 결과만 출발 주소 기준의 거부 규칙(만료 시각·근거 경보 번호 포함)으로 `xdr/web-injection/deny-rules.json`에 저장하고, 알림을 `xdr/alerts.log`에 한 줄씩 쌓습니다. 정상 이벤트와 주소가 겹치거나 막을 수 없는 주소는 규칙을 만들지 않습니다. `src/decider.mjs`에는 연결하지 않았습니다.
- 다시 실행하는 방법
  - 판정 결과: `npm run xdr:run -- web-injection` (`xdr/web-injection/result.json` 갱신)
  - 읽기 확인: `node xdr/web-injection/read-alerts.mjs` (경보 건수와 뽑은 줄 수가 같아야 함)
  - 규칙·알림 만들기: `node xdr/web-injection/respond.mjs` (`deny-rules.json`, `alerts.log`는 실행마다 달라져서 커밋하지 않음)
- 확인한 것: 위 `npm run xdr:run` 결과가 block 8, alert 9, record 9였고, 정상 후보(규칙 수준 3 이하) 9건은 모두 record였습니다. `respond.mjs`는 임시 폴더에서 같은 경보를 다시 흘려 block 경보의 주소 6개(당시 경보 7건)만 막히고 나머지 19건은 통과하는 것을 확인했습니다.
- 하지 않은 것
  - 명령 구분자 경보(wi-06)는 처음에 근거 있는 패턴이 없어 alert였습니다. 명령 삽입(CAPEC-88, CWE-78) 패턴과 근거 한 줄을 `patterns.json`과 `decide.mjs`에 추가해 block이 됐습니다. `respond.mjs` 시험은 이 추가 전 결과이며 다시 하지 않았습니다.
  - 거부 규칙은 `src/decider.mjs`에 연결하지 않았습니다. 판정기 요청에는 출발 주소 항목이 없고, 새 이유 코드는 운영 등록부 등록이 필요합니다. 실제 접속 차단이라고 보지 않습니다.
  - 반복 건수 구간·확신도 가중치·규칙 만료 1시간은 MITRE에 없는 연습용 값이고 이 연습 경보에 맞춰 정했습니다. 패턴 근거의 CAPEC·CWE 번호는 온라인으로 대조하지 않았습니다. 심판의 판정이 아닙니다.
  - `npm run bundle`은 실행하지 않았습니다(미실행).

## 10단계 현재 상태: 백업에서 자료실을 되살립니다

- 정책 비교(`src/restore-plan.mjs`, `npm run restore:plan`): `restore/policy-snapshot.json`의 검증된 정책 사본과 현재 시험 정책(규칙 이름, 허용 경로, 로그인 발급자, 원본 API 주소)의 차이만 읽기 전용으로 보여 줍니다. 복원할 버전·변경 범위·확인 번호가 먼저 나오고, 사본이 없거나 형식·digest가 틀리면 중단합니다.
- 정책 복원(`src/restore-apply.mjs`, `npm run restore:apply -- --confirm=<확인 번호>`): 확인 번호가 계획과 같을 때만 `aleph.config.json`의 `allowedRoutes`·`identityProvider`·`originalApiUrl`을 사본 값으로 되돌립니다. 다른 설정 항목과 코드는 그대로이고, `ruleIds`가 다르면 자동 복원하지 않고 중단합니다. 감사 기록 `restore/audit.log`에는 덧붙이기만 합니다.
- 메모 한 건 복원: `POST /api/memo-restore/:id`(메모 서비스 `vault.memo`, 로그인 필요). 비공개 사본 표 `memo_backups`와 ID·소유자·내용 해시를 대조한 한 건만 되살리고, 다른 메모는 건드리지 않으며 감사 표 `memo_restore_audit`에는 덧붙이기만 합니다. 자세한 내용은 위 「10단계 제작 3」, 복구 뒤 확인 순서는 「10단계 제작 4」를 봅니다.
- 1~9단계의 기능과 규칙은 바꾸지 않았습니다. `src/resources.mjs`에 새 경로의 자원 ID만 추가했습니다.

### 확인 순서

1. `npm run test:restore`: pass 18. 정책 비교·복원 10건, 메모 복원 8건.
2. `npm run decider:test`(통과 네 줄), `npm run fixture:7`, `npm run detect:test`(통과 여섯 줄), `npm run test:r5`(pass 2), `npm run test:package`(pass 3).
3. 배포 뒤 확인은 「10단계 제작 4」의 표를 따릅니다.

### 아직 확인하지 못한 것

- 정책 사본(`restore/policy-snapshot.json`)을 만드는 기능과 실제 사본이 없어 `restore:plan`은 `SNAPSHOT_MISSING`으로 중단됩니다. 실제 정책 복원은 실행하지 않았습니다.
- 2026-10-14 학생이 직접 한 확인(학생이 알려 준 결과이며 이 저장소에서 다시 실행하지 않았습니다): Supabase SQL Editor에서 `docs/MEMO_BACKUPS.sql`을 실행해 두 표가 `rls_on = true`로 나왔고, 시험 계정 B의 가상 메모 사본 한 건을 넣은 뒤 배포 주소에서 B로 보낸 `POST /api/memo-restore/:id`가 200(`{id, contentHash}`, 해시는 사본과 같음), 이어진 `GET /api/memos/:id`가 200(복원된 제목·본문)이었고, A로 보낸 같은 요청은 404 `NOT_FOUND`였습니다. 감사 표의 행 수와 다른 메모 보존은 직접 조회하지 않아 미실행입니다.
- 메모 사본을 만드는(백업 쓰기) 기능은 없습니다.
- `restoreRoute`가 `/aleph.json`에 실리는지는 확인하지 못했습니다. `scripts/deployment-identity.mjs`는 `restoreRoute`를 아직 싣지 않습니다.

## 10단계 저장점

- 저장점: 10단계 「백업에서 자료실을 되살립니다」.
- 지금 작동하는 기능
  1. 검증된 정책 사본과 현재 시험 정책의 차이를 보여 주고, 확인 번호를 받은 뒤에만 설정 파일의 정책 항목을 되돌립니다. 사본이 없거나 검증에 실패하면 중단합니다.
  2. 로그인한 본인의 메모 한 건을 비공개 사본에서 ID·소유자·내용 해시를 대조한 뒤 되살리고, 다른 메모와 감사 기록은 보존합니다.
  3. 9단계 탐지, 8단계 구역, 7단계 추가 확인, 6단계 기기 규칙, 5단계까지의 기능은 그대로입니다.
- 다시 실행하는 방법: 위 「확인 순서」. 제출 묶음은 `bundle-notes.json`을 이번 단계 내용으로 고친 뒤 `npm run bundle`을 실행하며, 이 명령은 당시 배포 주소에 실제 요청 14건을 보냈습니다(12단계부터는 요청을 보내지 않고 `not_run`으로 기록). 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 10으로 올렸고 `restoreRoute`를 `POST /api/memo-restore/:id`로 채웠습니다. `identityProvider`, `allowedRoutes`, `originalApiUrl`은 9단계와 같고 구현과 일치합니다. `allowedRoutes`에는 복원 경로를 넣지 않았습니다. `judgeIssuer`는 바꾸지 않았습니다.
  - `src/decider.mjs`는 바꾸지 않았고 `RULE_IDS`의 여섯 규칙은 모두 코드에 있습니다.
  - `src/attack-check.mjs`에 `anonymous_memo_restore`(로그인 없이 복원 경로에 보내면 401)를 더해 14건입니다. 이번 저장점에서 이 점검은 실행하지 않았습니다(미실행).

## 11단계 현재 상태: 설치형 웹앱과 기기 승인

- 설치형 화면: `public/manifest.webmanifest`(앱 이름 「BYTE BACK 내 자료실」), 아이콘 `public/icons/`, 오프라인 안내 `public/offline.html`, 안내 전용 서비스 워커 `public/sw.js`. 서비스 워커는 화면 이동이 네트워크 오류로 실패할 때만 안내 페이지를 보여 주며 자료·토큰·`/api` 응답은 가로채거나 저장하지 않습니다. 따로 설치하는 접속 프로그램은 없고, 설치했다는 표시는 기기 확인 근거가 아닙니다.
- 기기 승인(`src/device-gate.mjs`, `api/device/index.js`, 표 `docs/DEVICES.sql`의 `device_registrations`): 서버가 기기 비밀값을 만들어 `HttpOnly`·`Secure`·`SameSite=Strict` 쿠키(`vault_device`, 경로 `/api`)로만 보내고, 표에는 SHA-256 해시만 둡니다. 화면 코드와 브라우저 저장소에는 기기 키가 없습니다. `GET /api/device`는 서버가 확인한 상태(`none`·`pending`·`approved`·`revoked`)를, `POST /api/device`는 `pending` 요청만 만듭니다. `approved`는 운영자가 Supabase에서 직접 바꾼 값뿐이며 앱 화면에는 승인 기능이 없습니다.
- 자료 보호: 로그인 검사 뒤 서버 표로 기기 승인을 확인하고(`/api/memos`, `/api/memos/:id`, `/api/memo-restore/:id`, `/api/notes`), 승인된 기기가 아니면 자료 없이 403 `DEVICE_NOT_APPROVED`, 표를 확인하지 못하면 503입니다. 화면은 서버가 `approved`라고 알려 줄 때만 메모·자료 화면을 엽니다. 심판 토큰은 반 엔진이 기기를 이미 확인한 요청이라 이 검사를 거치지 않습니다.
- 이 표는 학생 앱의 서버 쪽 기기 등록부이며 반 엔진의 `deviceRegistered`(판정기 요청 항목)와 별개입니다. `src/decider.mjs`는 `decide()`가 객체가 아닌 입력(null 등)에서 예외를 던지지 않고 기존 6단계 규칙으로 거부하도록 가드 한 줄만 더했습니다. 함수 이름·인자·응답 다섯 항목과 규칙은 그대로이고 `RULE_IDS` 여섯 규칙은 모두 코드에 있습니다.
- 1~10단계의 기능과 규칙은 바꾸지 않았습니다.

### 확인 순서

1. `npm run test:device`(pass 6), `npm run test:pwa`(pass 3), `npm run test:r5`(pass 2), `npm run test:package`(pass 3), `npm run test:restore`(pass 18), `npm run decider:test`(통과 네 줄), `npm run detect:test`(통과 여섯 줄). 모두 가상 값과 메모리 저장소로 한 로컬 연습입니다.
2. 배포 전 Supabase SQL Editor에서 `docs/DEVICES.sql`을 실행해 `rls_on = true`를 확인합니다.
3. 배포 뒤 시크릿 창에서 A로 로그인합니다. 승인 전에는 화면에 자료가 없고 `/api/memos`가 403이어야 합니다. 「이 기기 승인 요청」은 「승인 대기 중」만 만들어야 합니다. 운영자가 `DEVICES.sql`의 `update`로 승인한 뒤 「상태 다시 확인」을 누르면 기존 화면이 열려야 합니다. 다른 창이나 계정 B에서는 같은 승인이 따라오지 않아야 합니다.

### 아직 확인하지 못한 것

- 2026-10-14 학생이 직접 한 확인(학생이 알려 준 결과이며 이 저장소에서 다시 실행하지 않았습니다): `docs/DEVICES.sql`을 Supabase SQL Editor에서 실행해 `rls_on = true`가 나왔습니다. 배포 주소에서 시험 계정 A로 로그인해 `/api/memos`를 보내면 승인 전 403 `DEVICE_NOT_APPROVED`(`state: none`), 「이 기기 승인 요청」 뒤 403(`state: pending`), 운영자가 SQL로 `approved`로 바꾼 뒤 화면에 「서버가 등록 기기로 확인함」과 메모 화면이 열리고 같은 요청이 200이었습니다. 다른 시크릿 창에서 같은 계정으로 로그인하면 승인이 따라오지 않고 403이었습니다. 서버 응답 머리글의 `Set-Cookie` 값과 계정 B로 한 확인은 하지 않았습니다(미실행). 승인 뒤 열린 화면의 세부 동작은 학생이 눈으로 본 결과입니다.
- `/api/device`를 `allowedRoutes`와 `src/resources.mjs`에 넣지 않았습니다. 자료 경로가 아니라 로그인·복원 경로처럼 두었으며, 배포에서 이 경로가 막히는지는 확인하지 못했습니다.
- (정정) 로그인 세션 토큰은 이제 `localStorage`에 저장하지 않고 탭 메모리에만 둡니다. 새로 고치면 다시 로그인해야 하며, 예전 버전이 남긴 `vault-session` 값은 접속할 때 한 번 지웁니다. 제작 2 점검의 `S11_KEY_EXPOSED`를 받고 고쳤으며, 그 점검기가 이 저장소에 없어 원인은 추정입니다. 같은 오류가 사라졌는지는 확인하지 못했습니다(미실행).
- 기기 승인을 판정기·반 엔진과 연결하지 않았습니다.

## 11단계 저장점

- 저장점: 11단계 「나만의 접속 앱을 완성합니다」.
- 지금 작동하는 기능
  1. 설치형 웹앱 설정과 오프라인 안내, 기기 승인 상태 표시. 설치 표시만으로 기기를 믿지 않습니다.
  2. 서버 표에서 `approved`로 확인된 기기만 자료·메모 경로가 열리고, 나머지는 403입니다. 승인은 앱 밖에서 운영자가 합니다.
  3. 10단계 복원, 9단계 탐지, 8단계 구역, 7단계 추가 확인, 6단계 기기 규칙, 5단계까지의 기능은 그대로입니다.
- 다시 실행하는 방법: 위 「확인 순서」. 제출 묶음은 `bundle-notes.json`을 이번 단계 내용으로 고친 뒤 `npm run bundle`을 실행하며, 이 명령은 당시 배포 주소에 실제 요청 16건을 보냈습니다(12단계부터는 요청을 보내지 않고 `not_run`으로 기록). 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 11로 올렸습니다. `identityProvider`, `allowedRoutes`, `originalApiUrl`, `restoreRoute`는 10단계와 같고 구현과 일치합니다. `judgeIssuer`는 바꾸지 않았습니다.
  - `src/attack-check.mjs`에 `anonymous_device_status`, `anonymous_device_request`(로그인 없이 `/api/device`에 보내면 401)를 더해 16건입니다. 승인 전 자료 거부(403)는 로그인한 계정이 필요해 이 점검에 없고, 2026-10-14 학생이 직접 확인했습니다(위 「아직 확인하지 못한 것」). `npm run bundle`은 같은 날 배포 뒤 다시 실행해 16건이 모두 기대대로 거부되었습니다(커밋 `6fbc888`).

## 12단계 설치·실행·중지·복구 안내

### 기준과 출처

- **기준 커밋**: 「12단계 저장점」 커밋(`git log -1`로 확인). 그 바로 앞 커밋 `7ea7141`(11단계) 위에 12단계 제작 1(탈환 작전실 `api/ops/summary.js`, `src/ops-summary.mjs`)·제작 2(확인표 `src/matrix.mjs`, `scripts/matrix-run.mjs`)·제작 3(이 안내)을 더한 것입니다. 아래 로컬 명령은 2026-10-14에 이 내용으로 실행했고, 배포·새 Vercel 프로젝트에서 처음부터 다시 따라 한 시험은 **미실행**입니다.
- **엔진 출처**: ALEPH SDP 엔진 사용. 요청의 신원·기기·경로를 확인해 판정기에 넘기고, 재인증과 접속 회수를 집행하고, 운영 등록부(`allowedReasonCodes`)와 심판 접수 서버(`judgeIssuer`)를 갖는 반 엔진은 수업에서 제공한 것입니다. **이 저장소에 엔진 코드는 없고 학생이 만들지 않았습니다.** 엔진과의 실제 연결은 이 저장소에서 시험하지 않았고, 아래 학생 몫은 엔진이 확인해 넘긴다고 약속한 요청·사건 계약(`docs/DECIDER_REQUEST.md`, `docs/DETECT_EVENTS.md`)에 맞춘 코드입니다.

| 구분 | 내용 | 파일 |
|---|---|---|
| ALEPH SDP 엔진(제공, 저장소 밖) | 신원·기기·경로 확인, 판정기 호출, 재인증, 접속 회수 집행, 운영 등록부, 심판 접수 | 없음 (계약 문서만 저장소에 있음) |
| 시작 틀(제공, 첫 커밋 `8e3e791`에 있던 것) | 판정기·탐지 함수의 빈 뼈대와 계약 문서, 로컬 연습 스크립트, 로그인 토큰 검사 도우미, 제출 묶음 스크립트, 배포 정보 기록, 패키지 양식, 연습 경보 자료 | `docs/DECIDER_REQUEST.md`, `docs/DETECT_EVENTS.md`, `scripts/decider-test.mjs`, `scripts/fixture-7.mjs`, `scripts/detect-test.mjs`, `scripts/bundle.mjs`, `scripts/deployment-identity.mjs`, `scripts/xdr-run.mjs`, `src/verify-login.mjs`, `package/`, `xdr/fixtures/` |
| 학생 몫: 판정기 | 6~8단계 규칙(`RULE_IDS` 여섯 개). 파일의 빈 뼈대(`decide` 이름·인자·응답 다섯 항목)는 시작 틀이 준 것이고 규칙 구현은 학생이 채웠습니다 | `src/decider.mjs` |
| 학생 몫: 탐지 규칙 | 9단계 다량 조회 탐지·회수 제안(빈 뼈대는 시작 틀, 규칙 구현은 학생), 보너스 `xdr/` 판정·대응(연습 경보 자료 `xdr/fixtures/`는 제공) | `src/detect.mjs`, `xdr/*/decide.mjs`, `read-alerts.mjs`, `respond.mjs` |
| 학생 몫: 접속 앱 | 로그인·세션 화면, 설치형 웹앱, 기기 승인 | `public/index.html`, `public/sw.js`, `public/manifest.webmanifest`, `public/offline.html`, `api/auth/`, `api/device/`, `src/device-gate.mjs`, `src/auth-api.mjs` |
| 학생 몫: 자료실 | 메모 API(소유자 검사), 가상 메모 읽기, 사본 복원, 정책 복원, 작전실·확인표 | `api/memos/`, `api/notes.js`, `api/memo-restore/`, `api/ops/`, `src/memo-api.mjs`, `src/memo-restore.mjs`, `src/restore-*.mjs`, `src/ops-summary.mjs`, `src/matrix.mjs`, `docs/*.sql` |

| 외부 라이브러리(내려받아 사용) | `@supabase/supabase-js` 2.117.2(로그인·DB 접근), `jose` 6.2.12(토큰 검사). 버전은 `package.json`, 설치 내용은 `package-lock.json` | `package.json` |
| 외부 서비스(사용) | GitHub(저장소), Vercel(배포·서버 함수·함수 로그), Supabase(로그인·DB) | `vercel.json`, `aleph.config.json` |
| 근거 자료(인용) | 보너스 `xdr/` 판정의 근거로 MITRE ATT&CK 번호(T1110, T1190)와 CAPEC·CWE 번호를 적었고 온라인으로 대조하지 않았습니다. 건수 구간·확신도 가중치는 학생이 정한 연습용 값입니다 | `xdr/*/patterns.json` |
| 코딩 도구(작성 도움) | 학생 몫 코드는 코딩 도구(Claude Code)의 도움을 받아 작성했고 학생이 확인·커밋했습니다. 커밋 37개 중 16개(보너스 xdr-01 이후)에 `Co-Authored-By` 줄이 있고, 그 이전 커밋에는 이 줄이 없어 이 기록만으로는 도움 여부를 가리지 못합니다. 코딩 도구는 ALEPH SDP 엔진이 아닙니다 | `git log` |

시작 틀 파일도 학생이 단계마다 고친 곳이 있습니다(예: `scripts/deployment-identity.mjs`, `src/attack-check.mjs`). 위 표는 처음 출처를 기준으로 합니다.

### 비밀값

이 안내에는 비밀번호·토큰·서버 전용 키·기기 쿠키 값을 쓰지 않았고 이름만 적습니다. 값은 Vercel의 환경변수 비밀 입력란이나 내 컴퓨터 셸에만 넣고, 코드·Git·캡처·답변에 올리지 않습니다. 비밀값을 파일로 만들어 저장소에 넣는 절차는 없습니다. `.env`는 `.gitignore`에 있습니다.

| 이름 | 쓰는 곳 | 값을 받는 곳 |
|---|---|---|
| `SUPABASE_URL` | 서버 함수 전체 | Supabase 프로젝트 설정 |
| `SUPABASE_SECRET_KEY` | 서버 함수 전용(화면·브라우저에 두지 않음) | Supabase 프로젝트 설정의 서버 전용 키 |
| `SUPABASE_PUBLISHABLE_KEY` | 로그인 서버 함수(`api/auth/*`) | Supabase 프로젝트 설정의 공개 키 |
| `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_URL`, `VERCEL_GIT_PROVIDER` | 빌드가 `public/aleph.json`을 만들 때 | Vercel이 배포 때 자동으로 제공(내가 넣지 않음) |
| `VAULT_TOKEN_A`, `VAULT_TOKEN_B`, `VAULT_DEVICE_COOKIE_A`, `VAULT_DEVICE_COOKIE_B`, `VAULT_A_MEMO_ID`, `VAULT_B_RESTORE_ID` | 확인표(`npm run matrix:run`)의 로그인한 항목만. 없으면 그 항목은 미실행 | 내 시험 계정으로 직접 로그인해 얻은 값을 내 셸에만 설정 |

### 설치 (내 컴퓨터)

1. Node.js 22 이상과 Git을 설치합니다(`package.json`의 `engines`).
2. 저장소를 내려받고 의존성을 설치합니다(`aleph.config.json`의 `repoUrl`).

```bash
git clone https://github.com/undeadmagician32-bot/choi-bujang-secret-vault.git
cd choi-bujang-secret-vault
npm install
```

### 설치 (배포: Vercel + Supabase)

1. Supabase에 시험용 프로젝트를 만들고, SQL Editor에서 `docs/`의 SQL을 단계 순서로 실행합니다: `MEMOS_TABLE.sql` → `MEMOS_RLS.sql` → `MEMOS_REVOKE.sql` → `MEMO_BACKUPS.sql` → `DEVICES.sql`. 각 파일 끝의 확인 쿼리에서 `rls_on = true`를 확인합니다. 가상 메모 테이블 `archive_notes`를 만드는 SQL은 메모 본문이 들어 있어 저장소에 없습니다. Supabase Auth의 시험 계정 A·B는 대시보드에서 직접 만듭니다.
2. Vercel에서 이 저장소를 연결한 새 프로젝트를 만들고, 위 표의 `SUPABASE_*` 세 이름을 비밀 입력란에 넣은 뒤 배포합니다. 환경변수를 바꾸면 다시 배포해야 반영됩니다. 빌드 명령과 공개 폴더는 `vercel.json`에 있습니다.
3. 배포가 끝나면 `aleph.config.json`의 `publicAppUrl`과 `/aleph.json`이 실제 주소와 커밋을 가리키는지 대조합니다.

### 실행 (재현 순서)

아래는 위에서 아래로 한 번씩 실행하는 순서입니다. 내 컴퓨터에서 상주하는 서버는 띄우지 않습니다. 이 저장소에는 로컬에서 `api/` 서버 함수를 실행하는 명령이 없어서, API 동작은 배포에서만 확인합니다.

1. **판정기** (학생 몫, 가상 요청 연습): `npm run decider:test`(「통과」 네 줄), `npm run fixture:7`(정상 `allow`, 복합 이상 `step_up`). 심판 판정이 아닙니다.
2. **탐지 규칙** (학생 몫, 가상 사건): `npm run detect:test`(「통과」 여섯 줄). 엔진의 사건 전달·접속 회수는 연결·시험하지 않았습니다(미실행). 보너스 연습 경보는 `npm run xdr:run -- brute-force`, `npm run xdr:run -- web-injection`입니다.
3. **자료실·접속 앱 코드 시험**: `npm run test:r5`(2), `npm run test:package`(3), `npm run test:device`(6), `npm run test:pwa`(3), `npm run test:restore`(18), `npm run test:ops`(7), `npm run test:matrix`(9). 모두 가상 값과 메모리 저장소로 한 연습입니다. 화면 파일만 만들 때는 `npm run build -- --local`입니다.
4. **접속 앱 (배포 주소, 시크릿 창)**: A로 로그인하면 승인 전에는 자료가 없고 `/api/memos`가 403입니다. 「이 기기 승인 요청」은 「승인 대기 중」만 만듭니다. 운영자가 `docs/DEVICES.sql`의 `update`로 승인한 뒤 「상태 다시 확인」을 누르면 메모 화면과 탈환 작전실이 열립니다. 세션 토큰은 탭 메모리에만 있어 새로 고치면 다시 로그인합니다.
5. **탈환 작전실**: 작전실의 「가린 서버 기록」 카드(응답의 `serverRecord`, 수치와 상태만 있고 식별자·메모 본문 없음)가 화면 카드의 수치와 모두 「일치」로 나와야 합니다. 이 기록은 Vercel 함수 로그 `OPS_SUMMARY`에 남는 값과 같아서, 「기록 번호」로 로그의 같은 줄을 찾아 맞춰 볼 수도 있습니다. 탐지·회수 집행·정책 사본 비교는 「미실행」으로 보여야 합니다.
6. **확인표**: `npm run matrix:run`(로그인 없이 보낼 수 있는 항목과 로컬 항목). 결과는 `artifacts/matrix.md`입니다. 계정 A·B 항목은 위 환경변수를 설정해야 실행되고, 메모·감사 기록을 쓰는 복원 항목은 `-- --include-writes`를 붙여야 합니다. 총공세 41종은 이 표로 통과시키지 않습니다(미실행 41).
7. **제출 묶음**: `bundle-notes.json`에 이번 단계에서 한 일을 적은 뒤 `npm run bundle`을 실행합니다. 12단계부터 번들은 요청을 보내지 않고 직접 점검 16건을 모두 `not_run`으로 기록합니다(심판의 규칙: 요청을 보내지 않은 점검은 `not_run`). 실제 요청 결과는 바로 아래 6번의 확인표에 따로 있습니다. `bundle-notes.json`과 `artifacts/`는 커밋하지 않습니다.

### 중지

- 내 컴퓨터: 상주 프로세스가 없어 중지할 것이 없습니다. 시험은 명령이 끝나면 끝납니다.
- 로그인 한 사람: 화면의 「로그아웃」이 서버에서 세션을 취소합니다.
- 기기 한 대: 운영자가 `docs/DEVICES.sql`의 회수 `update`(`status = 'revoked'`)를 실행하면 그 기기의 자료 요청이 403이 됩니다. 앱 화면에는 이 기능이 없고, 탐지의 회수 제안을 자동으로 집행하는 경로도 없습니다.
- 자료실 전체: Vercel에서 이 프로젝트의 배포를 내리거나 환경변수를 지우는 일은 이 저장소 밖의 작업이고, 이번에 실행하지 않았습니다. 프로젝트를 지우면 되돌릴 수 없고 옛 배포 주소 문제는 「옛 노출」 문단 그대로입니다.

### 복구

1. **정책 되돌리기**: `npm run restore:plan`이 사본과 현재 정책의 차이와 확인 번호를 보여 주고, 맞으면 `npm run restore:apply -- --confirm=<확인 번호>`를 실행합니다. 끝나면 `npm run restore:plan`을 다시 실행해 「차이 없음」을 확인합니다. 정책 사본(`restore/policy-snapshot.json`)을 만드는 기능과 실제 사본이 없어 현재는 `SNAPSHOT_MISSING`으로 중단되고, 실제 정책 복원은 실행한 적이 없습니다.
2. **메모 한 건 되살리기**: `docs/MEMO_BACKUPS.sql`이 적용되어 있고 사본 표에 시험 계정의 가상 메모가 있을 때, 그 계정으로 로그인한 `POST /api/memo-restore/<메모 ID>`가 200이어야 합니다. 다른 계정으로 같은 요청을 보내면 404입니다(2026-10-14 학생이 직접 확인, 「10단계 현재 상태」). 사본을 만드는 기능은 없습니다.
3. **배포 되돌리기**: 코드가 잘못되었으면 `git revert`로 되돌리는 새 커밋을 만들어 다시 배포합니다(`git reset --hard`는 쓰지 않습니다, `AGENTS.md`). 학습 DB 자료는 지우지 않습니다. 이 순서를 실제 배포에서 실행해 본 적은 없습니다(미실행).
4. **복구 뒤 확인**: 「10단계 제작 4」의 순서와 `npm run matrix:run`으로 1~11단계의 정상 요청이 허용되고 금지 요청이 거부되는지 다시 봅니다. 통과로 적을 수 있는 것은 실제로 보낸 요청의 결과뿐입니다.

### 이 안내가 확인하지 못한 것

- 새 Vercel 프로젝트와 새 Supabase 프로젝트에서 이 순서를 처음부터 따라 해 본 시험은 미실행입니다. `package/README.md`는 아직 양식 그대로입니다.
- ALEPH SDP 엔진과 학생 판정기·탐지 함수의 실제 연결, 엔진이 집행하는 접속 회수, 운영 등록부의 이유 코드 등록 여부는 확인하지 못했습니다.
- SQL의 적용 순서는 각 파일의 머리말과 단계 기록을 근거로 적었고 이번에 다시 실행하지 않았습니다.

## 12단계 저장점

- 저장점: 12단계 「탈환 작전실을 완성합니다」(제작 1~3).
- 지금 작동하는 기능
  1. 승인된 기기에서 열리는 「탈환 작전실」이 `GET /api/ops/summary`의 판정기 규칙·탐지·회수 상태·복구 버전 요약을 보여 주고, 서버 응답으로 확인한 것과 미실행을 구분합니다. 응답에 함께 싣는 「가린 서버 기록」(`serverRecord`)을 화면에 보이고 화면 수치와 칸마다 대조하며, 서버 로그 `OPS_SUMMARY`와 같은 값입니다. 메모 본문은 표시하지 않습니다.
  2. `npm run matrix:run`이 1~11단계의 정상·금지 요청을 실제로 보내(또는 함수를 불러) 기대·실제 결과·요청 ID·확인 시각을 `artifacts/matrix.md`에 남깁니다. 실행하지 않은 항목과 총공세 41종은 미실행으로 남고 통과로 세지 않습니다.
  3. 위 「12단계 설치·실행·중지·복구 안내」. 1~11단계의 기능과 규칙은 바꾸지 않았습니다.
- 다시 실행하는 방법: `npm run test:ops`(7), `npm run test:matrix`(9)와 기존 시험은 위 「실행」 순서. 제출 묶음은 `bundle-notes.json`을 12단계 내용으로 고친 뒤 `npm run bundle`을 실행합니다(요청을 보내지 않고 점검 16건을 `not_run`으로 기록. 실제 요청 결과는 `npm run matrix:run`의 `artifacts/matrix.md`). `bundle-notes.json`과 `artifacts/`는 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step`을 12로 올렸고(`src/attack-check.mjs`의 허용 단계에 12를 추가), `identityProvider`, `allowedRoutes`, `originalApiUrl`, `restoreRoute`, `judgeIssuer`는 11단계와 같습니다. `allowedRoutes`와 `src/resources.mjs`에 `/api/ops/summary`는 넣지 않았습니다(새 자원 ID가 운영 등록부에 있는지 확인하지 못했습니다).
  - `RULE_IDS`의 여섯 규칙은 모두 코드에 있고 `src/decider.mjs`는 바꾸지 않았습니다.
  - `src/attack-check.mjs`는 점검 이름 16건(11단계와 같음)을 그대로 두되, 요청을 보내지 않고 모두 `observed: not_run`으로 기록합니다. 11단계까지 이 파일이 직접 보내던 요청(결과 401·404 등)은 `src/matrix.mjs`의 확인표가 맡고, 그 실측 결과는 위 「확인한 것과 하지 않은 것」에 있습니다. 이 변경 뒤 번들 JSON의 점검 칸은 실제 결과가 아니라 미실행 표시입니다.
- 확인한 것과 하지 않은 것
  - 로컬 시험은 가상 값으로 모두 통과했습니다(위 명령). 이것은 심판의 판정이 아닙니다.
  - 2026-10-14 학생이 배포에서 작전실을 열어 화면의 기록 번호 `239ccbaa`, 규칙 6개, 탐지 미실행, 기기 수 0·3·0을 Vercel 로그 `OPS_SUMMARY`의 같은 번호·수치와 맞춰 보았습니다(스크린샷 기준, 로그 줄 오른쪽의 사본 수·복원 기록 수는 잘려 대조하지 못했습니다).
  - 같은 날 `npm run matrix:run`을 배포 주소에 실행했습니다. 로그인 없이 보낸 요청과 로컬 항목은 34건 통과·미실행 8건이었고, 학생이 시험 계정 A·B의 값을 내 셸 환경변수로 설정해 `-- --include-writes`까지 붙여 다시 실행한 결과는 42건 중 통과 42·실패 0·오류 0·미실행 0이었습니다(`artifacts/matrix.md`, 커밋하지 않음). 계정 A·B 값은 이 저장소와 기록에 남기지 않았고 결과 파일에서도 찾지 못했습니다. 이 확인표는 심판의 판정이 아닙니다.
  - 총공세 41종은 실행 0, 미실행 41입니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포하고 `X-Content-Type-Options: nosniff` 머리글을 붙입니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 저장점에서는 실제 주소로 채웠습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 배포 주소에 비로그인 요청과 위조 토큰 요청을 보내 상태 코드를 기록합니다(3단계 기준, 위 「3단계 저장점」 참고).

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 10단계 제작 3: 사본에서 메모 한 건 복원

- 서비스: 메모 서비스(자원 ID `vault.memo`). 경로: **`POST /api/memo-restore/:id`** (`api/memo-restore/[id].js`, 대조 규칙은 `src/memo-restore.mjs`). 로그인 토큰이 필요하고, 본문은 선택 항목 `{ "contentHash": "<64자 소문자 16진수>" }` 하나뿐입니다.
- 비공개 가상 메모 사본은 Supabase 표 `public.memo_backups`, 감사 기록은 `public.memo_restore_audit`입니다. 만드는 SQL은 `docs/MEMO_BACKUPS.sql`이며 메모 본문은 들어 있지 않습니다. 두 표는 공개 권한을 모두 회수했고 서버 함수(전용 키)만 씁니다. 감사 표는 덧붙이기만 되고 수정·삭제·비우기는 트리거가 막습니다. 사본 행의 `content_hash`는 `src/memo-restore.mjs`의 `contentHashOf(title, body)`와 같은 값으로 사본을 만들 때 적습니다.
- 복원 전 대조(하나라도 다르면 쓰지 않음): ① 사본의 메모 ID = 요청한 ID, ② 사본의 소유자 = 서버가 토큰으로 확인한 사용자, ③ 사본 내용으로 다시 계산한 해시 = 사본에 적힌 해시(요청이 `contentHash`를 주었다면 그 값과도 같아야 함). 남의 사본·없는 사본은 같은 404(`NOT_FOUND`), 해시가 다르면 409(`HASH_MISMATCH`, `BACKUP_INTEGRITY_FAILED`)입니다. 현재 메모가 다른 사람 소유로 남아 있으면 덮어쓰지 않습니다.
- 쓰는 범위: 그 메모 한 행(없으면 추가, 있으면 제목·본문만 수정)과 감사 기록 덧붙이기뿐입니다. 다른 메모 행과 기존 감사 행은 읽지도 쓰지도 않습니다. 감사 기록을 남기지 못하면 복원하지 않습니다. 응답은 `200 { id, contentHash }`이며 메모 내용은 싣지 않습니다.
- 확인한 것(가상 값, 메모리 store 시험): `npm run test:restore`의 `memo-restore` 8건. 시험 계정 B의 메모 한 건이 사본의 ID·소유자·해시 그대로 돌아오고, A가 B의 사본을 지정하면 404로 아무것도 쓰지 않으며, 다른 메모는 그대로입니다.
- 확인하지 못한 것: 배포 주소에서 실제 시험 계정 B 토큰으로 보낸 요청, Supabase 표에 SQL을 적용한 상태, `aleph.config.json`의 `restoreRoute`·`allowedRoutes`에 이 경로를 싣는 일(저장점 단계에서 구현과 대조), 8단계 판정기 구역표(`src/decider.mjs`의 `ZONES`)에 이 경로 추가(엔진이 이 경로를 판정기로 보내는지 계약에 없어 바꾸지 않음).

## 10단계 제작 4: 복구 뒤 1~9단계를 다시 확인하는 순서

복구가 끝났다고 보려면 자료와 정책이 돌아왔는지, 이전에 막던 요청이 다시 거부되는지를 아래 순서로 직접 봅니다. 「상태」 칸은 실제로 실행한 것만 적습니다. 실행하지 않은 것은 **미실행**이며, 실행한 사람이 결과를 적을 때까지 바꾸지 않습니다. 로컬 시험은 가상 요청 연습이며 심판의 판정이 아닙니다.

### 순서

1. **정책 되돌리기** (사본이 있을 때): `npm run restore:plan`으로 복원할 버전과 바뀔 항목을 읽고, 맞으면 출력의 확인 번호로 `npm run restore:apply -- --confirm=<확인 번호>`를 실행합니다. 끝난 뒤 `npm run restore:plan`을 다시 실행해 「차이 없음」이 나와야 정책이 돌아온 것입니다. `ruleIds` 차이로 중단되면 `src/decider.mjs`를 먼저 사본과 맞춥니다.
2. **자료 되돌리기**: `docs/MEMO_BACKUPS.sql`이 적용되어 있고 사본 표에 시험 계정 B의 가상 메모가 있을 때, 배포 뒤 B로 로그인한 요청 `POST /api/memo-restore/<메모 ID>`가 200을 돌려주고 `GET /api/memos/<같은 ID>`의 제목·본문 해시(`contentHashOf`)가 사본과 같아야 자료가 돌아온 것입니다. 같은 요청을 A 토큰으로 보내면 404여야 합니다.
3. **재배포**: 정책 파일을 되돌렸으면 다시 배포해야 반영됩니다. 배포가 끝난 뒤에만 4~5를 합니다.
4. **로컬 명령** (배포 없이 실행): 아래 표의 명령을 위에서부터 실행합니다.
5. **배포 주소 점검**: 표의 「배포」 항목을 시크릿 창과 A·B 두 계정으로 보냅니다. `npm run bundle`은 12단계부터 요청을 보내지 않고 직접 점검을 `not_run`으로 `artifacts/submission.json`에 적습니다(당시 11단계 이전에는 요청 14건을 보냈습니다). 실제 요청 결과는 `npm run matrix:run`의 표에 있습니다. 이 파일과 `bundle-notes.json`은 커밋하지 않습니다.
6. **기록**: 실행한 항목은 날짜와 결과를 상태 칸에 적고, 실행하지 못한 항목은 미실행으로 남깁니다. 실패한 항목은 첫 오류만 적고 한 가지씩 고칩니다.

### 단계별 정상·금지 요청

| 단계 | 정상 요청(유지되어야 함) | 금지 요청(거부되어야 함) | 확인 방법 | 상태 |
|---|---|---|---|---|
| 1 | `/`가 로그인 폼으로 열림 | 비로그인 `/data.json`에서 가상 메모 확인 표시가 보이지 않음 | 배포: `npm run bundle`의 `anonymous_data_json` | 확인함(2026-10-14 `npm run matrix:run`, `/` 200·`/data.json` 404) |
| 2 | 로그인 뒤 가상 메모가 보임 | 배포 파일·GitHub 최신 파일에서 `실습용 가[상]` 검색 결과 없음 | 배포: 「가상 메모 문장 검색 확인」 절차 | 미실행 |
| 3 | A 로그인 뒤 메모 목록 200 | 비로그인·위조 토큰의 `/api/notes`, `/api/memos` 다섯 경로가 401 | 배포: `npm run bundle`의 `anonymous_*`, `forged_token_*` | 확인함(2026-10-14 `npm run matrix:run`: A 목록 200, 비로그인·위조 토큰 401) |
| 4 | A가 자기 메모 읽기·수정 200 | B가 A의 메모를 읽기·수정·삭제하면 404 | 배포: 두 계정, B 로그인 뒤 A 메모 주소로 `fetch` | 확인함(2026-10-14 `npm run matrix:run`: A 자기 메모 200, B가 A 메모 404 `NOT_FOUND`). 수정·삭제 시도는 미실행 |
| 5 | 화면이 `/api/memos`로 자료를 읽음 | 공개 키로 원본 자료 API 직접 요청이 401·403, 첫 화면 코드에 공개 키 없음 | 배포: `npm run bundle`의 `direct_original_api_anon`, `home_code_has_no_key`, `home_security_header` | 미실행 |
| 5 | `/aleph.json`에 `allowedRoutes`·`originalApiUrl`이 실려 있음 | — | 배포: `/aleph.json` 열기 | 미실행 |
| 5·정책 | — | 정책 사본과 현재 정책의 차이 없음 | `npm run restore:plan` | 사본이 없어 `SNAPSHOT_MISSING`으로 중단됨(2026-10-14, 로컬). 사본을 만든 뒤 미실행 |
| 6 | 등록 기기의 읽기 요청 `allow` | 미등록 기기 요청 `deny`(`device_not_registered`) | `npm run decider:test` | 통과 네 줄(2026-10-14, 로컬) |
| 7 | 다시 확인한 복합 이상 접속 `allow`, 정상 사건 `allow` | 복합 이상 접속(0~5시 + 처음 보는 네트워크 + 짧은 시간 많은 읽기) `step_up` | `npm run decider:test`, `npm run fixture:7` | 통과 네 줄, `allow`·`step_up`(2026-10-14, 로컬) |
| 8 | A의 메모 읽기·수정 `allow` | 공지 수정 `deny`, 쿼리·`/notes/:id/export`·DELETE `route_not_allowed`, 학생 공지 수정 403, 비로그인 공지 수정 401 | `npm run decider:test`에는 이 경우가 들어 있지 않아 저장된 시험이 없음. 서버 쪽은 배포에서 확인 | 미실행 |
| 8 | 배포의 `/api/memos`와 `/api/notes` 응답 머리글 `X-Resource-Id`가 서로 다름 | — | 배포: 개발자 도구 네트워크 탭 | 미실행 |
| 9 | 정상 조회 30건, 정확히 120건은 `observe` | 10분 안 121건 이상은 `propose_revocation`(`burst_read`) | `npm run detect:test` | 통과 여섯 줄(2026-10-14, 로컬) |
| 9 | — | 실제 접속 회수 | 운영 반 엔진과의 연결이 필요함 | 미실행 |
| 로컬 묶음 | — | — | `npm run test:r5`, `npm run test:package` | pass 2, pass 3(2026-10-14, 로컬) |
| 10 | B의 사본 한 건 복원, 다른 메모 보존 | A가 B의 사본을 지정하면 404, 해시·소유자·ID 불일치 거부, 정책 사본 없음·digest 불일치 중단 | `npm run test:restore` | pass 18(2026-10-14, 로컬, 가상 값·메모리 저장소) |
| 10 | 배포에서 B의 메모 복원 200, 이어서 조회 200 | 배포에서 A 토큰으로 같은 요청 404 | 배포: 순서 2 | 확인함(2026-10-14, 학생이 두 계정으로 직접 실행): B 200·조회 200, A 404. 감사 표 조회는 미실행 |

### 읽는 법

- 「통과(로컬)」는 가상 요청이나 메모리 저장소로 한 연습이며, 배포된 서버·실제 DB·두 계정으로 한 시험이 아닙니다. 같은 줄의 「배포」 확인이 끝나기 전까지 그 단계가 복구됐다고 쓰지 않습니다.
- 4단계의 「B가 A의 메모를 요청하면 404」와 10단계의 「A가 B의 사본을 요청하면 404」는 두 계정으로 보낸 실제 요청이 있어야 확인됩니다. 10단계는 2026-10-14에 학생이 직접 확인했고(A 404), 4단계는 같은 날 `npm run matrix:run`으로 B가 A의 메모를 읽을 때 404 `NOT_FOUND`를 확인했습니다(수정·삭제 시도는 미실행).
- 8단계 판정기 구역 규칙을 다시 볼 저장된 시험이 없습니다. 이 칸을 채우려면 별도의 시험을 추가하거나 배포에서 직접 요청해야 합니다.
