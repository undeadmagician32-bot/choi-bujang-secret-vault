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

- 브라우저 코드(`public/index.html`)는 메모 자료를 Supabase에서 직접 읽거나 고치는 곳이 없습니다. 자료는 모두 서버 함수(`/api/notes`, `/api/memos`, `/api/memos/:id`)를 부릅니다.
- **화면 코드에는 Supabase 키가 없습니다.** 저장점 때는 화면이 공개 키로 Supabase에 직접 로그인했는데, 심판 점검 「화면 코드에 공개 키가 없다」에 걸려서 로그인·세션 갱신·로그아웃을 서버 함수로 옮겼습니다. 서버가 같은 공식 SDK(`signInWithPassword`, `refreshSession`, `auth.admin.signOut`)를 부르고, 비밀번호와 토큰은 서버가 만들지도 저장하지도 않습니다(Supabase가 발급).

| 경로 | 동작 |
|---|---|
| `POST /api/auth/login` | `{email, password}` → `{access_token, refresh_token, expires_at, email}`. 실패하면 Supabase가 알려 준 이유를 `message`로 돌려줌 |
| `POST /api/auth/refresh` | `{refresh_token}` → 새 세션. 만료·취소된 토큰이면 401 |
| `POST /api/auth/logout` | `Authorization: Bearer` 토큰의 로그인 세션을 서버 전용 키로 취소. 토큰이 없으면 401 |

- 화면은 서버가 돌려준 세션을 이 브라우저의 `localStorage`에 보관하고(비밀번호는 보관하지 않음), 만료 1분 전이면 `/api/auth/refresh`로 갱신한 뒤 자료를 요청합니다.
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

## 10단계 현재 상태: 백업에서 자료실을 되살립니다

저장점은 아래 「10단계 저장점」입니다. Supabase SQL과 복원 요청 한 건은 학생이 2026-10-13에 실행했습니다(아래 「아직 확인하지 못한 것」). 배포 확인은 학생이 정상이라고 알려 왔고, 어떤 항목을 봤는지는 듣지 못했습니다. 금지 요청(비로그인 401, 남의 메모 404, 사본 해시 409)의 실제 배포 시험과 복구 뒤 1~9단계 재확인은 미실행입니다.

### 서비스와 경로

| 서비스 | 경로 | 하는 일 |
|---|---|---|
| 메모 복원 (`api/memos/restore/[id].js`, 자원 ID `vault.memo`) | `POST /api/memos/restore/:id` | 본문 없이 경로의 ID만 받아 로그인한 본인의 메모 한 건을 비공개 사본에서 되살립니다. 성공하면 200 `{ id, restored: true, contentSha256, contentHash }`(두 해시 값은 같음). |
| 비공개 메모 사본 (Supabase 테이블 `public.memos_backup`) | 외부 경로 없음 | 메모를 새로 만들 때 서버 함수(`api/memos/index.js`)가 사본을 덧붙이고, 이미 있으면 건드리지 않아 가장 이른 내용이 남습니다. 서버 전용 키는 읽기·덧붙이기(SELECT·INSERT)만 합니다. `docs/MEMOS_BACKUP.sql`로 만들고, 그 전에 있던 메모는 SQL로 한 번 일괄 사본을 뜹니다. anon·authenticated 권한은 모두 회수합니다. |
| 복원 감사 기록 (Supabase 테이블 `public.memos_restore_audit`) | 외부 경로 없음 | 복원이 성공할 때마다 메모 ID·소유자·내용 해시·결과를 한 줄 덧붙입니다(제목·본문은 적지 않음). 서버 전용 키는 읽기·덧붙이기만 하고 수정·삭제 권한은 없습니다. |
| 정책 차이 보기 (`scripts/policy-diff.mjs`) | 로컬 명령 `npm run policy:diff` | 검증한 안전 정책 사본(`backup/policy-snapshot.json`)과 현재 정책 파일 여섯 개의 차이만 보여 줍니다. 읽기 전용. |
| 정책 되돌리기 (`scripts/policy-restore.mjs`) | 로컬 명령 `npm run policy:restore` | 미리보기 뒤 `-- --confirm <버전 7자리>`(또는 `--confirm=<버전>`)를 붙였을 때만 바뀐 정책 파일을 사본 버전으로 되돌립니다. 정책 밖 파일은 건드리지 않고, `backup/policy-restore-audit.log`에는 한 줄만 덧붙이며, 바뀌기 전 내용은 `backup/pre-restore/`에 남깁니다. |
| 정책 사본 만들기 (`scripts/policy-snapshot.mjs`) | 로컬 명령 `npm run policy:snapshot` | 침해 전에 현재 정책 파일 여섯 개를 「검증한 안전 정책 사본」(`backup/policy-snapshot.json`)으로 저장합니다. 미리보기 뒤 `-- --confirm <버전>`을 적었을 때만 쓰고, 사본이 이미 있으면 덮어쓰지 않습니다. |

- 정책 파일 여섯 개: `aleph.config.json`, `vercel.json`, `src/decider.mjs`, `src/detect.mjs`, `src/resources.mjs`, `docs/MEMOS_RLS.sql`.
- `aleph.config.json`: `step` 10, `allowedRoutes`에 `POST /api/memos/restore/:id`를 더했고 `restoreRoute`를 같은 값으로 채웠습니다. 빌드(`scripts/deployment-identity.mjs`)가 10단계부터 `restoreRoute`를 `aleph.json`에 싣고, 비어 있거나 `"METHOD /경로"` 꼴이 아니거나 `allowedRoutes`에 없으면 빌드가 실패합니다.
- 복원 처리 순서: 로그인(401) → ID 형식(400) → 사본 읽기(없거나 남의 것이면 404) → 사본 해시 다시 계산(다르면 409, 아무것도 쓰지 않음) → 그 한 건만 되돌리기(지워졌으면 같은 ID로 다시 만들기) → 다시 읽어 ID·소유자·해시 대조(다르면 500) → 감사 기록 덧붙이기 → 200. 내용 해시는 `sha256(제목 || 0x00 || 본문)`(UTF-8, 소문자 16진수)이고 `src/memo-api.mjs`의 `memoContentSha256`과 SQL이 같은 계산입니다. 줄바꿈으로 구분하면 제목·본문의 줄바꿈 위치만 다른 두 메모가 같은 해시가 될 수 있어 `0x00`을 썼습니다.
- 남의 메모 ID나 사본이 없는 ID는 같은 404, 같은 ID의 살아 있는 행이 본인 것이 아니면 덮어쓰지 않고 404, 비로그인 401, POST가 아닌 요청 405, ID 형식 오류 400입니다. 본문은 읽지 않아서 본문의 `owner_id`는 무시됩니다. `owner_id`는 확인된 사용자 ID로만 쓰고 기존 메모의 소유자는 바꾸지 않습니다. 다른 메모와 사본 테이블은 바꾸지 않고, 감사 기록은 덧붙이기만 합니다. 로그에는 `MEMO_RESTORED` 같은 고정 문구만 남깁니다. 지워진 메모를 되살리면 `created_at`은 새로 찍힙니다.

### 확인 순서

1. `npm run memo:restore:test`: pass 10. 시험 계정 B의 가상 메모 한 건만 복원합니다(B 메모 수정 뒤 복원, 지워진 B 메모 복원, 새로 만든 B 메모의 사본 덧붙이기). 복원마다 감사 기록이 한 줄 늘고 사본 해시가 틀리면 409입니다. A의 메모 ID는 「B가 요청하면 거부되는지」 확인에만 쓰고 복원하지 않습니다. 가짜 로그인·가짜 DB이며 실제 Supabase나 배포에는 요청하지 않습니다.
2. `npm run judge-owner:test`(pass 3), `npm run policy:snapshot:test`(pass 6), `npm run policy:diff:test`(pass 5), `npm run policy:restore:test`(pass 4), `npm run test:r5`(pass 3), `npm run test:package`(pass 3).
3. 배포 뒤(SQL 1~3번은 학생이 실행했고 나머지는 미실행): SQL Editor에서 `docs/MEMOS_BACKUP.sql`의 1·2번을 실행하고 3번 확인에서 `hash_mismatch`가 0인지, 사본·감사 테이블의 권한이 service_role의 SELECT·INSERT만 true인지 봅니다. `/aleph.json`에 `restoreRoute`가 보이는지 먼저 확인합니다. 로그인 없이 `POST /api/memos/restore/<ID>`는 401이어야 합니다. B로 로그인해 B 메모 하나를 만들고 고친 뒤 개발자 도구 콘솔에서 `/api/memos/restore/<그 ID>`를 POST하면 200이고, 다시 읽은 메모가 처음 사본 내용이며 응답의 `contentHash`가 사본과 같아야 합니다. A 메모 ID로 보내면 404여야 합니다.

### 복구 뒤 1~9단계 다시 확인하는 순서

복구를 마친 뒤 위에서 아래로 실행합니다. 「복구 뒤 결과」 칸은 실제로 실행한 뒤 날짜와 본 결과만 적고, 실행하지 않은 칸은 미실행으로 둡니다. 이 표를 쓴 시점에는 복구 자체를 하지 않았으므로 아래 결과 칸은 모두 미실행입니다.

**가. 복구하기**

1. `npm run policy:restore`로 복원할 버전과 되돌릴 파일을 확인합니다. 맞으면 `npm run policy:restore -- --confirm <버전 7자리>`(또는 `--confirm=<버전>`)를 실행합니다. 정책 사본이 없거나 검증에 실패하면 중단되며, 그때는 복구를 멈추고 사본부터 확인합니다.
2. 바뀐 메모마다 B로 로그인해 `POST /api/memos/restore/<메모 ID>`를 보냅니다(경로의 ID만, 본문 없음, 메모 한 건씩).
3. 되돌린 파일을 커밋·push하고 Vercel 배포가 끝났는지 Deployments에서 봅니다. 아래 「다」의 배포 확인은 새 배포가 끝나야 의미가 있습니다.

**나. 자료와 정책이 돌아왔는지**

| 확인 | 명령·방법 | 돌아왔을 때 | 실패 | 복구 뒤 결과 |
|---|---|---|---|---|
| 정책 | `npm run policy:diff` | 「변경 범위: 변경 0개, 현재 없음 0개」 | 파일이 하나라도 나오거나 「중단」 | 미실행 |
| 메모 사본 | SQL Editor에서 `docs/MEMOS_BACKUP.sql`의 3번 | `hash_mismatch` 0 | 1 이상 | 2026-10-13 SQL 3번(학생 실행): `backups` 3, `hash_mismatch` 0(캡처로 확인). 권한(service_role의 SELECT·INSERT만 true)과 `rls_on`은 학생이 정상이라고 알려 왔고 결과 표는 보지 못함. 복원 뒤 재확인은 미실행 |
| 복원한 메모 | B로 로그인해 `GET /api/memos/<ID>` | 사본과 같은 제목·본문, 응답 200 | 404, 내용이 다름 | 2026-10-13 20:13 배포에서 복원 요청 한 건: HTTP 200, `restored: true`, `contentSha256`과 `contentHash`가 같은 값(학생 콘솔 캡처, 로그인한 시험 계정, 메모 한 건). 복원 뒤 `GET /api/memos/<ID>`로 내용을 다시 읽어 사본과 대조하는 일, 복원 전후 내용이 달라졌는지는 확인하지 못함(미실행) |
| 다른 메모 | A로 로그인해 메모 목록 | 복구 전과 같은 건수·제목 | 줄거나 바뀜 | 미실행 |

**다. 단계별 정상 요청과 금지 요청** (「로컬」은 내 컴퓨터에서 가상 요청으로 하는 연습이고, 「배포」는 새 배포가 끝난 뒤에 합니다)

| 단계 | 정상 요청 (계속 되어야 함) | 금지 요청 (다시 거부되어야 함) | 명령·방법 | 복구 뒤 결과 |
|---|---|---|---|---|
| 1~2 | 비로그인 `/` 200, 로그인 폼만 보임 | 비로그인 `/data.json` 404, `/`와 `/aleph.json`에 메모 문장 없음 | 배포: 시크릿 창과 「가상 메모 문장 검색 확인」 | 미실행 |
| 3 | A 로그인 뒤 `/api/notes` 200 | 비로그인·위조 토큰으로 `/api/notes`, `/api/memos` 401 | 배포: `npm run bundle`의 직접 점검(정상 요청은 화면에서 로그인) | 미실행 |
| 4 | A가 자기 메모 읽기·수정 200 | B가 A 메모 읽기·수정·삭제 404, 본문으로 소유자 바꾸기 403 | 배포: 화면 로그인 뒤 개발자 도구 콘솔 `fetch` | 미실행 |
| 5 | 화면이 `/api/memos`로 메모를 읽음 | 공개 키로 `originalApiUrl` 직접 요청 401, 첫 화면 코드에 키 없음 | 배포: `npm run bundle`의 직접 점검 | 미실행 |
| 6 | 등록 기기 읽기 `allow` | 미등록 기기 `deny device_not_registered` | 로컬: `npm run decider:test` | 미실행 |
| 7 | 정상 사건 `allow` | 복합 이상 사건 `step_up` | 로컬: `npm run decider:test`, `npm run fixture:7` | 미실행 |
| 8 | A 메모 응답의 `X-Resource-Id: vault.memo` | 학생 공지 수정 403, 비로그인 공지 수정 401, 구역 밖 경로 `route_not_allowed` | 배포: 네트워크 탭과 콘솔 `fetch`. 판정기 쪽은 로컬 `npm run decider:test` | 미실행 |
| 9 | 정상 조회 30건·정확히 120건 `observe` | 10분 안 121건·200건 회수 제안 | 로컬: `npm run detect:test` | 미실행 |
| 10 | B가 자기 메모 복원 200 | B가 A 메모 ID로 복원 404, 사본 해시가 틀리면 409 | 로컬: `npm run memo:restore:test`. 배포: 콘솔 `fetch` | 2026-10-13 20:13 배포에서 복원 요청 한 건: HTTP 200, `restored: true`, `contentSha256`과 `contentHash`가 같은 값(학생 콘솔 캡처, 로그인한 시험 계정, 메모 한 건)(정상 요청). 금지 요청(남의 메모 ID 404, 비로그인 401, 사본 해시 409)의 배포 시험은 미실행. 로컬 `memo:restore:test`는 복구 뒤 결과가 아님 |
| 공통 | 위 시험이 그대로 통과 | — | 로컬: `npm run test:r5`, `npm run test:package`, `npm run policy:diff:test`, `npm run policy:restore:test` | 미실행 |

- 로컬 명령 정상 결과: `decider:test` 「통과」 네 줄, `fixture:7` 「정상 사건: allow」·「복합 이상 사건: step_up」, `detect:test` 「통과」 여섯 줄, `memo:restore:test` pass 10, `test:r5` pass 3, `test:package` pass 3, `policy:diff:test` pass 5, `policy:restore:test` pass 4, `policy:snapshot:test` pass 6, `judge-owner:test` pass 3. 「확인 필요」나 「첫 오류」가 한 줄이라도 나오면 실패입니다.
- `npm run bundle`은 커밋되지 않은 파일이 있으면 멈춥니다. 복구한 파일을 커밋한 뒤 실행합니다. 직접 점검 결과는 학생 자기 점검이며 심판의 판정이 아닙니다.
- 6·7·9단계 명령은 가상 요청 연습입니다. 실제 미등록 기기 접속, 추가 확인 흐름, 접속 회수는 운영 엔진과 심판이 확인하며 이 저장소에서는 미실행입니다.
- 로그인 토큰이 필요한 점검(4·8단계의 B 요청)은 토큰을 코드나 제출 묶음에 둘 수 없어 `attack-check.mjs`에 넣지 못했습니다. 화면 로그인 뒤 콘솔로만 확인합니다.
- 실패한 줄이 있으면 그 줄의 단계 파일을 `npm run policy:diff`로 다시 보고, 첫 실패 하나만 근거로 고칩니다.

**참고: 복구 전 현재 상태의 로컬 사전 실행** (2026-10-13 19:53, 복구 뒤 결과가 아닙니다). `decider:test` 통과 4줄, `fixture:7` 정상 `allow`·복합 이상 `step_up`, `detect:test` 통과 6줄, `memo:restore:test` pass 10, `test:r5` pass 3, `test:package` pass 3, `policy:diff:test` pass 5, `policy:restore:test` pass 4, `policy:snapshot:test` pass 6, `judge-owner:test` pass 3(모두 fail 0). 실제 설정으로 `npm run build`(가짜 Vercel 환경변수)를 돌려 `public/aleph.json`에 `restoreRoute`가 실리는 것까지 확인했습니다. 배포·화면·SQL이 필요한 칸은 한 건도 실행하지 않았습니다.

### 아직 확인하지 못한 것

- Supabase SQL 1·2·3번은 학생이 2026-10-13에 실행했습니다: 1·2번 성공, 3번 `backups` 3·`hash_mismatch` 0(캡처로 확인). 사본·감사 테이블의 권한(service_role의 SELECT·INSERT만 true)과 `rls_on`은 학생이 알려 왔고 저는 결과 표를 보지 못했습니다. 복원 요청은 2026-10-13 20:13에 배포에서 한 건 실행해 200을 받았습니다(위 「복구 뒤」 표). 서버는 사본 해시를 서버 코드(`memoContentSha256`)로 다시 계산해 저장된 값과 같을 때만 쓰므로(다르면 409), 이 메모는 SQL이 만든 해시와 서버 코드의 해시가 일치했다는 뜻입니다. 코드상 200은 감사 기록을 덧붙인 뒤에만 돌려주지만 `memos_restore_audit` 행은 SQL로 직접 보지 않았습니다(미실행).
- 배포된 `/aleph.json`에 `restoreRoute`가 보이는지는 새 배포가 끝나야 확인할 수 있습니다(미실행). 심판이 이 값을 어떻게 읽는지는 저장소 안에 설명이 없어, 수업 안내와 다른 학생의 경험을 따라 `"METHOD /경로/:id"` 꼴로 적었습니다.
- 사본은 SQL을 실행한 뒤 새로 만든 메모부터 자동으로 덧붙습니다. 그 전에 있던 메모는 SQL 2번으로 일괄 사본을 떠야 하며, 사본이 없는 메모를 요청하면 404입니다. 사본을 쓰지 못해도 메모 만들기는 성공하고 고정 코드(`MEMO_BACKUP_FAILED`)만 남습니다.
- 감사 기록을 덧붙이지 못하면(테이블 없음 등) 메모는 이미 되살아난 뒤라도 500 `AUDIT_FAILED`를 돌려줍니다.
- 심판 토큰의 주인 구분: `src/verify-login.mjs`는 심판 토큰에서 `identity`(a/b)를 돌려주지만 예전 `authorize`는 `userId`(sub)만 써서, 심판이 A·B에 같은 `sub`를 쓰면 B가 A의 메모를 자기 것으로 다룰 수 있었습니다(심판이 같은 `sub`를 쓰는지는 이 저장소만으로는 확인하지 못했고, 수업 팁을 따라 대비했습니다). 이제 `src/memo-api.mjs`의 `ownerKeyFor`가 심판 토큰이면 `sub`와 `identity`를 묶어 만든 고정 UUID를 주인 키로 쓰고, 학생 토큰은 확인된 `sub` 그대로입니다. 4단계 메모 경로와 복원 경로가 모두 이 키를 `owner_id`로 씁니다. 이전 실행에서 심판 토큰의 `sub`로 저장된 메모는 새 키로는 보이지 않습니다. `api/notes.js`의 강사 역할 확인은 바꾸지 않았습니다. 가짜 검증기 시험만 했고 실제 심판 토큰으로는 미실행입니다.
- 검증한 안전 정책 사본(`backup/policy-snapshot.json`)은 만들지 않았습니다. 지금 `npm run policy:diff`와 `npm run policy:restore`는 「사본 없음」으로 중단합니다. 침해 전에 `npm run policy:snapshot`으로 만들고 커밋해야 합니다.

## 10단계 저장점

- 저장점: 10단계 「백업에서 자료실을 되살립니다」.
- 지금 작동하는 기능
  1. `POST /api/memos/restore/:id`는 비공개 사본(`memos_backup`)에서 로그인한 본인의 메모 한 건만 ID·소유자·내용 해시를 대조해 되살리고, 복원마다 감사 기록(`memos_restore_audit`)을 한 줄 덧붙입니다. 요청 본문은 읽지 않습니다.
  2. 메모를 새로 만들면 비공개 사본이 함께 덧붙고, 이미 있는 사본은 덮어쓰지 않아 가장 이른 내용이 남습니다.
  3. `npm run policy:snapshot`으로 검증한 안전 정책 사본을 만들고, `npm run policy:diff`로 차이만 보고, `npm run policy:restore`로 확인한 버전(`--confirm 버전` 또는 `--confirm=버전`)일 때만 정책 파일을 되돌립니다. 사본이 없거나 검증에 실패하면 중단합니다.
  4. 빌드가 `restoreRoute`를 `/aleph.json`에 싣습니다(`allowedRoutes`에 같은 값이 없으면 빌드가 실패).
  5. 심판 토큰은 `sub`와 `identity`(a/b)를 묶은 고정 UUID를 주인 키로 써서, 같은 `sub`의 A·B가 서로의 메모를 자기 것으로 다루지 못합니다(학생 토큰은 `sub` 그대로).
  6. 9단계 탐지, 8단계 구역, 7단계 추가 확인, 6단계 기기 규칙, 5단계까지의 기능은 그대로입니다.
- 다시 실행하는 방법: 위 「확인 순서」와 「복구 뒤 1~9단계 다시 확인하는 순서」. 제출 묶음은 `bundle-notes.json`을 이번 단계 내용으로 고친 뒤 `npm run bundle`을 실행하며, 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 커밋하지 않습니다.
- 설정 대조 (`aleph.config.json`)
  - `step` 10, `allowedRoutes`와 `restoreRoute`는 모두 `POST /api/memos/restore/:id`이고 `api/memos/restore/[id].js`, `src/resources.mjs`와 일치합니다. `scripts/deployment-identity.mjs`가 10단계부터 `restoreRoute`를 `aleph.json`에 싣습니다. `identityProvider`, `originalApiUrl`, `judgeIssuer`는 바꾸지 않았습니다.
  - `src/decider.mjs`는 바꾸지 않았고 `RULE_IDS`의 여섯 규칙은 모두 코드에 있습니다.
  - `src/attack-check.mjs`는 5단계 점검 13건 그대로이고 허용 단계 목록에 10이 들어 있습니다(점검 내용은 그대로). 복원 경로 점검은 새 배포가 끝나야 의미가 있어 넣지 않았습니다(미실행).
- 하지 않은 것: 금지 요청(비로그인 401, 남의 메모 ID 404, 사본 해시 409)의 실제 배포 시험, 복원 전후 내용 비교, 감사 기록 행 확인, 복구 뒤 1~9단계 재확인(위 표의 나머지 결과 칸은 미실행), 정책 사본 파일(`backup/policy-snapshot.json`) 만들기. Supabase SQL과 복원 요청 한 건(200)은 학생이 실행했습니다(위 「아직 확인하지 못한 것」).

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

## 보너스 xdr-03 저장점: 알려진 취약점 악용 탐지

- 대상: `xdr/fixtures/known-cve.json`의 연습 경보 24건(수업용 가상 Wazuh 모양). 근거는 CVE-2021-44228 형태 요청과 MITRE ATT&CK T1190(외부 공개 앱 악용)이고, 신호는 요청 머리글·인자 안의 원격 조회 구문(jndi 형태)과 알려진 취약점 점검 도구의 흔적입니다.
- 지금 작동하는 기능
  1. `xdr/known-cve/decide.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상 block, 0.5 이상 alert, 그 아래 record입니다. import 문이 없고 파일을 읽거나 쓰지 않습니다. 패턴 세 개는 `patterns.json`과 같은 내용을 파일 맨 위 상수로 가집니다. 원격 주소까지 갖춘 완전한 조회 구문이 있을 때만 block이고, CVE 번호·jndi 단어·중괄호처럼 단서만 있으면 alert(최대 0.8)입니다.
  2. `xdr/known-cve/read-alerts.mjs`: 확인용 읽기 모듈입니다. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 문자열은 가립니다. 조회 구문이 든 머리글·주소 항목은 뽑지 않습니다. `decide.mjs`는 불러오지 않습니다.
  3. `xdr/known-cve/respond.mjs`: block 결과만 출발 주소 기준의 거부 규칙(만료 시각·근거 경보 번호 포함)으로 `xdr/known-cve/deny-rules.json`에 저장하고, 알림을 `xdr/alerts.log`에 한 줄씩 쌓습니다. 정상 이벤트와 주소가 겹치거나 막을 수 없는 주소는 규칙을 만들지 않습니다. `src/decider.mjs`에는 연결하지 않았습니다.
- 다시 실행하는 방법
  - 판정 결과: `npm run xdr:run -- known-cve` (`xdr/known-cve/result.json` 갱신)
  - 읽기 확인: `node xdr/known-cve/read-alerts.mjs` (경보 건수와 뽑은 줄 수가 같아야 함)
  - 규칙·알림 만들기: `node xdr/known-cve/respond.mjs` (`deny-rules.json`, `alerts.log`는 실행마다 달라져서 커밋하지 않음)
- 확인한 것: 위 `npm run xdr:run` 결과가 block 8, alert 8, record 8이었고, 정상 후보(규칙 수준 3 이하) 8건은 모두 record였습니다. 읽기 모듈은 경보 24건과 뽑은 줄 24줄이 같았습니다. `respond.mjs`는 임시 폴더에서 같은 경보를 다시 흘려 block 경보 8건(주소 7개)만 막히고 나머지 16건은 통과하는 것을 확인했습니다.
- 하지 않은 것
  - 거부 규칙은 `src/decider.mjs`에 연결하지 않았습니다. 판정기 요청에는 출발 주소 항목이 없고, 새 이유 코드는 운영 등록부 등록이 필요합니다. 실제 접속 차단이라고 보지 않습니다.
  - 확신도 가중치·단서 상한 0.8·규칙 만료 1시간은 MITRE·NVD에 없는 연습용 값이고 이 연습 경보에 맞춰 정했습니다. CVE·MITRE 근거는 온라인으로 대조하지 않았습니다. 심판의 판정이 아닙니다.
  - `npm run bundle`은 실행하지 않았습니다(미실행).

## 보너스 xdr-04 저장점: 몰래 심어진 프로그램 탐지

- 대상: `xdr/fixtures/persistence.json`의 연습 경보 24건(수업용 가상 Wazuh 모양). 근거는 MITRE ATT&CK T1543.003(Windows 서비스), T1053.005(예약 작업), T1547.001(실행 키·시작 폴더)이고, 신호는 서명 없는 새 서비스 등록, 낯선 예약 작업, 시작 폴더 변경입니다. 시작 폴더 변경은 MITRE에서 T1547.001로 분류되어 그 번호를 근거로 적었습니다(연습 경보는 T1543을 붙여 둠).
- 지금 작동하는 기능
  1. `xdr/persistence/decide.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상 block, 0.5 이상 alert, 그 아래 record입니다. import 문이 없고 파일을 읽거나 쓰지 않습니다. 패턴 세 개는 `patterns.json`과 같은 내용을 파일 맨 위 상수로 가집니다. 패턴의 중심 조건에 받침 신호(서명 없음·임시 폴더 경로·반복·수업 시간 밖 실행) 하나 이상이 붙을 때만 block이고, 서비스·예약 작업·시작 폴더 단서만 있으면 규칙 수준 4 이상에서 alert(최대 0.8)입니다.
  2. `xdr/persistence/read-alerts.mjs`: 확인용 읽기 모듈입니다. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 문자열은 가립니다. `decide.mjs`는 불러오지 않습니다.
  3. `xdr/persistence/respond.mjs`: block 결과만 출발 주소 기준의 거부 규칙(만료 시각·근거 경보 번호 포함)으로 `xdr/persistence/deny-rules.json`에 저장하고, 알림을 `xdr/alerts.log`에 한 줄씩 쌓습니다. 계정은 정상 이벤트에도 나와서 막지 않고, 정상 이벤트와 주소가 겹치거나 막을 수 없는 주소는 규칙을 만들지 않습니다. `src/decider.mjs`에는 연결하지 않았습니다.
- 다시 실행하는 방법
  - 판정 결과: `npm run xdr:run -- persistence` (`xdr/persistence/result.json` 갱신)
  - 읽기 확인: `node xdr/persistence/read-alerts.mjs` (경보 건수와 뽑은 줄 수가 같아야 함)
  - 규칙·알림 만들기: `node xdr/persistence/respond.mjs` (`deny-rules.json`, `alerts.log`는 실행마다 달라져서 커밋하지 않음)
- 확인한 것: 위 `npm run xdr:run` 결과가 block 8, alert 8, record 8이었고, 정상 후보(규칙 수준 3 이하) 8건은 모두 record였습니다. 읽기 모듈은 경보 24건과 뽑은 줄 24줄이 같았습니다. `respond.mjs`는 임시 폴더에서 같은 경보를 다시 흘려 block 경보 8건(주소 7개)만 막히고 나머지 16건은 통과하며, 만료 뒤에는 막히지 않는 것을 확인했습니다.
- 하지 않은 것
  - 거부 규칙은 `src/decider.mjs`에 연결하지 않았습니다. 판정기 요청에는 출발 주소 항목이 없고, 새 이유 코드는 운영 등록부 등록이 필요합니다. 실제 접속 차단이라고 보지 않습니다.
  - 확신도 가중치·단서 상한 0.8·규칙 만료 1시간은 MITRE에 없는 연습용 값이고 이 연습 경보에 맞춰 정했습니다. MITRE 근거는 온라인으로 대조하지 않았습니다. 심판의 판정이 아닙니다.
  - `npm run bundle`은 실행하지 않았습니다(미실행).

## 보너스 xdr-05 저장점: 권한 가로채기 탐지

- 대상: `xdr/fixtures/privilege.json`의 연습 경보 26건(수업용 가상 Wazuh 모양). 근거는 MITRE ATT&CK T1068(권한 상승 악용), T1078(정상 계정 도용)이고, 신호는 관리자 그룹 추가, 처음 보는 관리자 명령, 업무 시간 밖 권한 사용입니다. 연습 경보의 시각은 모두 09~15시라서 업무 시간 밖인지는 설명 문장으로 봅니다. 관리자 그룹 추가는 MITRE에서 T1098.007로 더 좁게 분류되지만 이번 근거 범위에 맞춰 `patterns.json` 메모에만 적었습니다.
- 지금 작동하는 기능
  1. `xdr/privilege/decide.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상 block, 0.5 이상 alert, 그 아래 record입니다. import 문이 없고 파일을 읽거나 쓰지 않습니다. 패턴 세 개는 `patterns.json`과 같은 내용을 파일 맨 위 상수로 가집니다. 패턴의 중심 조건에 받침 신호(처음 보는 주소·여러 계정·다시 들어옴·방금 관리자가 됨·다른 계정 권한) 하나 이상이 붙을 때만 block이고, 관리자 명령·권한 상승·그룹 단서만 있으면 규칙 수준 4 이상에서 alert(최대 0.8)입니다. 관리자 그룹이 아닌 그룹 추가와 실패한 관리자 명령은 block하지 않습니다.
  2. `xdr/privilege/read-alerts.mjs`: 확인용 읽기 모듈입니다. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 문자열은 가립니다. `decide.mjs`는 불러오지 않습니다.
  3. `xdr/privilege/respond.mjs`: block 결과만 출발 주소 기준의 거부 규칙(만료 시각·근거 경보 번호 포함)으로 `xdr/privilege/deny-rules.json`에 저장하고, 알림을 `xdr/alerts.log`에 한 줄씩 쌓습니다. 계정은 권한을 빼앗긴 정상 사용자일 수 있어서 막지 않고, 정상 이벤트와 주소가 겹치거나 막을 수 없는 주소는 규칙을 만들지 않습니다. `src/decider.mjs`에는 연결하지 않았습니다.
- 다시 실행하는 방법
  - 판정 결과: `npm run xdr:run -- privilege` (`xdr/privilege/result.json` 갱신)
  - 읽기 확인: `node xdr/privilege/read-alerts.mjs` (경보 건수와 뽑은 줄 수가 같아야 함)
  - 규칙·알림 만들기: `node xdr/privilege/respond.mjs` (`deny-rules.json`, `alerts.log`는 실행마다 달라져서 커밋하지 않음)
- 확인한 것: 위 `npm run xdr:run` 결과가 block 9, alert 8, record 9였고, 정상 후보(규칙 수준 3 이하) 9건은 모두 record였습니다. 읽기 모듈은 경보 26건과 뽑은 줄 26줄이 같았습니다. `respond.mjs`는 임시 폴더에서 같은 경보를 다시 흘려 block 경보 9건(주소 8개)만 막히고 나머지 17건은 통과하며, 만료 뒤에는 막히지 않는 것을 확인했습니다.
- 하지 않은 것
  - 거부 규칙은 `src/decider.mjs`에 연결하지 않았습니다. 판정기 기존 규칙을 고치지 않았고, 실제 접속 차단이라고 보지 않습니다.
  - 확신도 가중치·단서 상한 0.8·규칙 만료 1시간은 MITRE에 없는 연습용 값이고 이 연습 경보에 맞춰 정했습니다. MITRE 근거는 온라인으로 대조하지 않았습니다. 심판의 판정이 아닙니다.
  - `npm run bundle`은 실행하지 않았습니다(미실행).

## 보너스 xdr-06 저장점: 자료 빼돌리기 탐지

- 대상: `xdr/fixtures/exfiltration.json`의 연습 경보 30건(수업용 가상 Wazuh 모양). 근거는 MITRE ATT&CK T1041(명령 통로로 유출), T1048(다른 프로토콜로 유출)이고, 신호는 처음 보는 목적지로 대용량 전송, 업무 시간 밖 압축 파일 반출, 명령 통로로 반복 전송입니다. 연습 경보의 시각은 모두 09~16시라서 업무 시간 밖인지는 설명 문장으로 봅니다.
- 지금 작동하는 기능
  1. `xdr/exfiltration/decide.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상 block, 0.5 이상 alert, 그 아래 record입니다. import 문이 없고 파일을 읽거나 쓰지 않습니다. 패턴 세 개는 `patterns.json`과 같은 내용을 파일 맨 위 상수로 가집니다. 패턴의 중심 조건(50MB 이상 전송과 처음 보는 목적지·평소와 다른 포트, 시간 밖 압축 파일 반출, 명령 통로·같은 목적지 대용량 전송)에 받침 신호(짧은 시간·묶음·전체·여러 목적지·파일 50개 이상·5번 이상 반복·시간 밖) 하나 이상이 붙을 때만 block이고, 단서만 있으면 규칙 수준 4 이상에서 alert(최대 0.8)입니다. 실패한 전송은 block하지 않습니다.
  2. `xdr/exfiltration/read-alerts.mjs`: 확인용 읽기 모듈입니다. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 문자열은 가립니다. `decide.mjs`는 불러오지 않습니다.
  3. `xdr/exfiltration/respond.mjs`: block 결과만 출발 주소 기준의 거부 규칙(만료 시각·근거 경보 번호·근거로 적는 목적지 주소 포함)으로 `xdr/exfiltration/deny-rules.json`에 저장하고, 알림을 `xdr/alerts.log`에 한 줄씩 쌓습니다. 계정은 정상 이벤트에도 나와서 막지 않고, 정상 이벤트와 주소가 겹치거나 막을 수 없는 주소는 규칙을 만들지 않습니다. `src/decider.mjs`에는 연결하지 않았습니다.
- 다시 실행하는 방법
  - 판정 결과: `npm run xdr:run -- exfiltration` (`xdr/exfiltration/result.json` 갱신)
  - 읽기 확인: `node xdr/exfiltration/read-alerts.mjs` (경보 건수와 뽑은 줄 수가 같아야 함)
  - 규칙·알림 만들기: `node xdr/exfiltration/respond.mjs` (`deny-rules.json`, `alerts.log`는 실행마다 달라져서 커밋하지 않음)
- 확인한 것: 위 `npm run xdr:run` 결과가 block 10, alert 10, record 10이었고, 정상 후보(규칙 수준 3 이하) 10건은 모두 record였습니다. 읽기 모듈은 경보 30건과 뽑은 줄 30줄이 같았습니다. `respond.mjs`는 임시 폴더에서 같은 경보를 다시 흘려 block 경보 10건(주소 9개)만 막히고 나머지 20건은 통과하며, 만료 뒤에는 막히지 않고 다시 흘려도 규칙이 늘지 않는 것을 확인했습니다.
- 하지 않은 것
  - 거부 규칙은 `src/decider.mjs`에 연결하지 않았습니다. 판정기 기존 규칙을 고치지 않았고, 실제 접속 차단이라고 보지 않습니다.
  - 전송량·파일 수·반복 횟수 기준, 확신도 가중치, 단서 상한 0.8, 규칙 만료 1시간은 MITRE에 없는 연습용 값이고 이 연습 경보에 맞춰 정했습니다. MITRE 근거는 온라인으로 대조하지 않았습니다. 심판의 판정이 아닙니다.
  - `npm run bundle`은 실행하지 않았습니다(미실행).

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포하고 `X-Content-Type-Options: nosniff` 머리글을 붙입니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 저장점에서는 실제 주소로 채웠습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 배포 주소에 비로그인 요청과 위조 토큰 요청을 보내 상태 코드를 기록합니다(3단계 기준, 위 「3단계 저장점」 참고).

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
