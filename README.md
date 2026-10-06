# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

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

- 브라우저 코드(`public/index.html`)는 메모 자료를 Supabase에서 직접 읽거나 고치는 곳이 없습니다. Supabase 호출은 로그인(`onAuthStateChange`, `getSession`, `signInWithPassword`, `signOut`)뿐이고, 자료는 모두 서버 함수(`/api/notes`, `/api/memos`, `/api/memos/:id`)를 부릅니다. 그래서 이번 단계에서 화면 코드는 바꾸지 않았습니다.
- 서버 함수의 로그인 검사, 소유자 검사, 서버 전용 설정(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`)은 그대로입니다.
- DB: 학습 DB의 `public.memos`에서 `PUBLIC`·`anon`·`authenticated`의 직접 권한을 모두 회수했습니다(`docs/MEMOS_REVOKE.sql`). 서버 전용 키가 쓰는 `service_role`은 그대로이고, RLS와 소유자 정책 네 개도 그대로 남겼습니다. 4단계에서 `authenticated`에 주었던 직접 접근은 이제 닫혀 있고, 메모는 서버 함수를 통해서만 읽고 쓸 수 있습니다.
- `aleph.config.json`의 `originalApiUrl`은 쿼리 없는 원본 자료 HTTPS 경로 `https://vfsfpmggzswszqljxznx.supabase.co/rest/v1/memos`입니다(메모 테이블을 DB에서 직접 읽는 주소). 공개 키로 이 주소에 직접 요청하면 거부되어야 하고, 심판이 공개 키로 확인합니다.
- 배포되는 `/aleph.json`에도 `originalApiUrl`이 실립니다. 빌드(`scripts/deployment-identity.mjs`)가 5단계부터 `aleph.config.json`의 `originalApiUrl`을 검사해서 `aleph.json`에 넣고, 없거나 http이거나 쿼리·비밀번호·조각이 붙어 있으면 빌드가 실패합니다. 심판은 설정 파일이 아니라 이 배포 파일을 읽습니다(5단계 저장점 직후 심판이 `S05_ORIGINAL_URL_MISSING`으로 알려 와서 고쳤습니다).

### 알려진 약점

- 허용 경로 검사(`allowedRoutes`는 기록일 뿐 서버가 강제하지 않음)와 호출 횟수 제한이 없습니다.
- 남의 메모 id로 `POST`하면 409 `ID_EXISTS`가 돌아와서, 그 id가 이미 있다는 사실(내용은 아님)이 드러납니다.
- `originalApiUrl`은 메모 테이블 하나만 가리킵니다. 가상 메모 테이블 `archive_notes`의 직접 경로는 이 값에 없지만, 2단계에서 `anon`·`authenticated` 권한을 모두 회수해 두었습니다(이번 단계에서 다시 확인하지는 않았습니다).
- 옛 커밋과 옛 배포의 `/data.json` 노출은 여전히 해소되지 않았습니다(위 「옛 노출」).

## 5단계 저장점

- 저장점: 5단계 「자료 요청을 서버 한곳으로 모읍니다」.
- 지금 작동하는 기능
  1. 화면은 자료를 서버 함수로만 요청하고, Supabase는 로그인에만 씁니다.
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
  - `src/attack-check.mjs`는 5단계 점검 11건(4단계 10건 + 토큰 없이 공개 키만으로 원본 자료 API에 직접 요청)입니다. 전부 상태 코드만 기록합니다.
  - `src/decider.mjs`의 `RULE_IDS`는 시작 틀의 `starter.deny` 하나뿐입니다. 6단계 이후에 구현합니다.
- 확인한 것과 하지 않은 것
  - 가짜 DB·가짜 토큰으로 A의 읽기·추가·수정·삭제 흐름과 무로그인 401을 시험했고 통과했습니다(임시 시험 파일은 저장소에 두지 않았습니다).
  - 권한 회수 뒤 `role_table_grants`, `has_table_privilege`, RLS 상태를 캡처로 확인했습니다. `role_table_grants`에는 `service_role` 행만 남았고, `anon`과 `authenticated`는 4개 권한이 모두 `false`, `service_role`은 모두 `true`, `rls_on = true`였습니다.
  - 공개 키로 `/rest/v1/memos`를 요청하면 HTTP 401, `permission denied for table memos`(42501)였고 자료는 오지 않았습니다(상태 코드만 확인).
  - 학생이 권한 회수 뒤 화면에서 A의 동작이 모두 정상이라고 알려 왔습니다(제가 화면을 직접 보지는 못했습니다).
  - **로그인 토큰(`authenticated`)으로 원본 자료 API에 직접 요청하는 점검은 하지 못했습니다(미실행).** 토큰을 코드나 제출 묶음에 둘 수 없어서입니다. 이 경로가 막혀 있다는 근거는 권한 확인(`has_table_privilege`)뿐입니다.
  - 로그인한 A·B 토큰으로 서로의 메모에 접근하는 점검도 4단계 때와 같이 미실행입니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포하고 `X-Content-Type-Options: nosniff` 머리글을 붙입니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 저장점에서는 실제 주소로 채웠습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 배포 주소에 비로그인 요청과 위조 토큰 요청을 보내 상태 코드를 기록합니다(3단계 기준, 위 「3단계 저장점」 참고).

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
