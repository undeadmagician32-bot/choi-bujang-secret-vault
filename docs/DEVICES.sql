-- 11단계: 서버 쪽 기기 등록부. Supabase SQL Editor에서 한 번 실행합니다.
-- 기기 비밀값은 들어 있지 않고 해시만 저장합니다. 공개 권한은 모두 회수하며 서버 함수(전용 키)만 읽고 씁니다.
begin;

create table if not exists public.device_registrations (
  id uuid primary key,
  owner_id uuid not null,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  label text check (label is null or char_length(label) between 1 and 40),
  requested_at timestamptz not null default now(),
  approved_at timestamptz
);

alter table public.device_registrations enable row level security;
revoke all on table public.device_registrations from public, anon, authenticated;

commit;

-- 정상 결과: rls_on = true.
select relname, relrowsecurity as rls_on from pg_class
where oid = 'public.device_registrations'::regclass;

-- ── 운영자가 하는 일 (앱 화면에는 이 기능이 없습니다) ──
-- 1) 대기 중인 요청 보기: 화면에 보이는 「요청 번호」와 같은 id를 찾아 라벨·요청 시각을 확인합니다.
--    select id, owner_id, label, requested_at from public.device_registrations where status = 'pending';
-- 2) 본인 기기가 맞을 때만 승인:
--    update public.device_registrations set status = 'approved', approved_at = now() where id = '<요청 번호>';
-- 3) 회수:
--    update public.device_registrations set status = 'revoked' where id = '<요청 번호>';
