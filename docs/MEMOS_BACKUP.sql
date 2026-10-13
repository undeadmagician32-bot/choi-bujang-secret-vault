-- 10단계: 메모의 비공개 사본 테이블. Supabase SQL Editor에서 실행합니다(기본 Run).
-- 이메일·사용자 ID·메모 본문은 이 파일에 들어 있지 않습니다. public.memos와 다른 테이블의 행은 바꾸지 않습니다.
-- 사본은 서버 함수(서버 전용 키, service_role)만 읽습니다. 복원 경로는 POST /api/memos/restore입니다.
-- content_sha256 = sha256(제목 UTF-8 || 0x00 || 본문 UTF-8)의 16진수. src/memo-api.mjs의 memoContentSha256과 같습니다.

-- 1. 사본 테이블 만들기와 권한 회수 (한 번에 실행)
begin;
create table if not exists public.memos_backup (
  id uuid primary key,
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 5000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  backed_up_at timestamptz not null default now()
);
alter table public.memos_backup enable row level security;
revoke all on table public.memos_backup from public, anon, authenticated;
commit;

-- 2. 침해 전에 사본 뜨기: 지금 메모를 사본에 넣습니다. 이미 사본이 있는 ID는 덮어쓰지 않습니다(on conflict do nothing).
insert into public.memos_backup (id, owner_id, title, body, content_sha256)
select id, owner_id, title, body,
       encode(sha256(convert_to(title, 'UTF8') || '\x00'::bytea || convert_to(body, 'UTF8')), 'hex')
from public.memos
on conflict (id) do nothing;

-- 3. 확인 (읽기 전용)
-- 사본 건수와 해시가 맞지 않는 행 수(0이어야 정상)
select count(*) as backups,
       count(*) filter (where content_sha256 <> encode(sha256(convert_to(title, 'UTF8') || '\x00'::bytea
         || convert_to(body, 'UTF8')), 'hex')) as hash_mismatch
from public.memos_backup;
-- anon·authenticated는 모두 false, rls_on = true
select r.role_name, p.priv, has_table_privilege(r.role_name, 'public.memos_backup', p.priv) as allowed
from (values ('anon'), ('authenticated')) r(role_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
order by r.role_name, p.priv;
select relname, relrowsecurity as rls_on from pg_class where oid = 'public.memos_backup'::regclass;
