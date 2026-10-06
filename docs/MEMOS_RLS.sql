-- 4단계: public.memos의 RLS와 최소 권한. Supabase SQL Editor에서 실행합니다(기본 Run, RLS 우회 아님).
-- 이메일·사용자 ID·메모 본문은 들어 있지 않습니다. 다른 테이블은 건드리지 않습니다.
-- 앱 API는 서버 전용 키(RLS를 건너뜀)로 접근하므로, 이 SQL은 공개 키와 로그인 토큰으로 DB에
-- 직접 접근하는 경우를 막는 두 번째 방어선입니다. 앱의 소유자 검사는 api/memos/[id].js에 있습니다.

-- 1. 적용 전후 확인 (읽기 전용, 쿼리를 하나씩 선택해서 실행)
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'memos'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by grantee, privilege_type;

select r.role_name, p.priv, has_table_privilege(r.role_name, 'public.memos', p.priv) as allowed
from (values ('anon'), ('authenticated')) r(role_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                   ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
order by r.role_name, p.priv;

select relname, relrowsecurity as rls_on from pg_class where oid = 'public.memos'::regclass;
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'memos';

-- 2. 적용 (한 번에 실행, 실패하면 모두 취소)
begin;

revoke all on table public.memos from public, anon, authenticated;

alter table public.memos enable row level security;

drop policy if exists memos_select_own on public.memos;
drop policy if exists memos_insert_own on public.memos;
drop policy if exists memos_update_own on public.memos;
drop policy if exists memos_delete_own on public.memos;

grant select, insert, update, delete on table public.memos to authenticated;

-- 읽기·삭제: 기존 행의 소유자가 본인일 때만
create policy memos_select_own on public.memos
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy memos_delete_own on public.memos
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- 추가: 새 행의 소유자가 본인일 때만
create policy memos_insert_own on public.memos
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- 수정: 기존 행도, 고친 뒤의 새 행도 소유자가 본인일 때만
create policy memos_update_own on public.memos
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

commit;

-- 정상 결과: anon·PUBLIC은 권한 없음, authenticated는 SELECT·INSERT·UPDATE·DELETE만,
-- rls_on = true, 정책 4개(select·insert·update·delete, 모두 authenticated).
