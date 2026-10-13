-- 10단계: 비공개 가상 메모 사본 테이블과 복원 감사 테이블. Supabase 대시보드의 SQL Editor에서 순서대로 실행합니다.
-- 이 파일에는 메모 본문이나 비밀값이 들어 있지 않습니다. 두 테이블 모두 서버 함수(service_role)는 읽기와 덧붙이기(INSERT)만 합니다.
-- 사본의 내용 해시: sha256(제목 UTF-8 바이트 || 0x00 || 본문 UTF-8 바이트)를 소문자 16진수로 적습니다.
-- (src/memo-api.mjs의 memoContentSha256과 같은 값이어야 합니다.)
-- 메모를 새로 만들면 서버 함수가 사본을 덧붙입니다(이미 있으면 건드리지 않아 가장 이른 내용이 남습니다).
-- 이 SQL을 실행하기 전에 만든 메모는 아래 2번으로 한 번 일괄 사본을 뜹니다.

-- 1. 테이블 만들기 (외부 경로 없음: anon·authenticated 권한 없음, 서버는 SELECT·INSERT만)
create table if not exists public.memos_backup (
  id uuid primary key,
  owner_id uuid not null,
  title text not null,
  body text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  backed_up_at timestamptz not null default now()
);
alter table public.memos_backup enable row level security;
revoke all on table public.memos_backup from public, anon, authenticated;
revoke update, delete, truncate on table public.memos_backup from service_role;
grant select, insert on table public.memos_backup to service_role;

create table if not exists public.memos_restore_audit (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null,
  owner_id uuid not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text not null,
  at timestamptz not null default now()
);
alter table public.memos_restore_audit enable row level security;
revoke all on table public.memos_restore_audit from public, anon, authenticated;
revoke update, delete, truncate on table public.memos_restore_audit from service_role;
grant select, insert on table public.memos_restore_audit to service_role;

-- 2. 이미 있는 메모의 일괄 사본 (침해 전에 한 번 실행). 이미 있는 사본은 덮어쓰지 않습니다(on conflict do nothing).
insert into public.memos_backup (id, owner_id, title, body, content_sha256)
select id, owner_id, title, body,
       encode(sha256(convert_to(title, 'UTF8') || '\x00'::bytea || convert_to(body, 'UTF8')), 'hex')
from public.memos
on conflict (id) do nothing;

-- 3. 확인 (읽기 전용, 하나씩 실행). 정상: hash_mismatch = 0, 권한은 service_role의 SELECT·INSERT만 true, rls_on = true.
select count(*) as backups,
       count(*) filter (where content_sha256 <>
         encode(sha256(convert_to(title, 'UTF8') || '\x00'::bytea || convert_to(body, 'UTF8')), 'hex')) as hash_mismatch
from public.memos_backup;

select t.table_name, r.role_name, p.priv, has_table_privilege(r.role_name, 'public.' || t.table_name, p.priv) as allowed
from (values ('memos_backup'), ('memos_restore_audit')) t(table_name)
cross join (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
order by t.table_name, r.role_name, p.priv;

select relname, relrowsecurity as rls_on from pg_class
where oid in ('public.memos_backup'::regclass, 'public.memos_restore_audit'::regclass);
