-- 10단계: 비공개 가상 메모 사본 테이블. Supabase 대시보드의 SQL Editor에서 순서대로 실행합니다.
-- 이 파일에는 메모 본문이나 비밀값이 들어 있지 않습니다. 사본은 침해 전에 뜨고, 서버 함수(service_role)는 읽기만 합니다.
-- 사본의 내용 해시: sha256(제목 UTF-8 바이트 || 0x00 || 본문 UTF-8 바이트)를 소문자 16진수로 적습니다.
-- (src/memo-api.mjs의 memoContentSha256과 같은 값이어야 합니다.)

-- 1. 사본 테이블 만들기 (외부 경로 없음: anon·authenticated 권한 없음, 서버는 SELECT만)
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
revoke insert, update, delete, truncate on table public.memos_backup from service_role;
grant select on table public.memos_backup to service_role;

-- 2. 사본 뜨기 (침해 전에 실행). 이미 있는 사본은 덮어쓰지 않습니다(on conflict do nothing).
insert into public.memos_backup (id, owner_id, title, body, content_sha256)
select id, owner_id, title, body,
       encode(sha256(convert_to(title, 'UTF8') || '\x00'::bytea || convert_to(body, 'UTF8')), 'hex')
from public.memos
on conflict (id) do nothing;

-- 3. 확인 (읽기 전용, 하나씩 실행). 정상: hash_mismatch = 0, 권한은 service_role의 SELECT만 true, rls_on = true.
select count(*) as backups,
       count(*) filter (where content_sha256 <>
         encode(sha256(convert_to(title, 'UTF8') || '\x00'::bytea || convert_to(body, 'UTF8')), 'hex')) as hash_mismatch
from public.memos_backup;

select r.role_name, p.priv, has_table_privilege(r.role_name, 'public.memos_backup', p.priv) as allowed
from (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
order by r.role_name, p.priv;

select relname, relrowsecurity as rls_on from pg_class where oid = 'public.memos_backup'::regclass;
