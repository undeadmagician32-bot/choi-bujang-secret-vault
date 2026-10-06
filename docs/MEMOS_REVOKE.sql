-- 5단계: public.memos의 직접 접근 권한을 모두 회수합니다. Supabase SQL Editor에서 실행합니다(기본 Run).
-- 이후 메모 자료는 서버 함수(서버 전용 키, service_role)만 읽고 씁니다.
-- 이메일·사용자 ID·메모 본문은 들어 있지 않습니다. 다른 테이블은 건드리지 않습니다.
-- 롤백(4단계 상태로): grant select, insert, update, delete on table public.memos to authenticated;

-- 1. 적용 전후 확인 (읽기 전용, 쿼리를 하나씩 선택해서 실행)
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'memos'
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

select r.role_name, p.priv, has_table_privilege(r.role_name, 'public.memos', p.priv) as allowed
from (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
order by r.role_name, p.priv;

select relname, relrowsecurity as rls_on from pg_class where oid = 'public.memos'::regclass;

-- 2. 적용 (service_role은 건드리지 않아 서버 함수는 그대로 동작합니다. RLS와 정책도 그대로 둡니다.)
begin;
revoke all on table public.memos from public, anon, authenticated;
commit;

-- 정상 결과(적용 후): role_table_grants에는 service_role 행만 남고, has_table_privilege는
-- anon·authenticated가 모두 false, service_role이 모두 true, rls_on = true.
-- 직접 요청 확인: 공개 키로 <프로젝트 주소>/rest/v1/memos를 요청하면 401(permission denied, 42501).
