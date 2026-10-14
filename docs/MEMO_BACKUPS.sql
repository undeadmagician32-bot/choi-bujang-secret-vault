-- 10단계: 비공개 가상 메모 사본과 복원 감사 표. Supabase SQL Editor에서 한 번 실행합니다.
-- 메모 본문·사용자 ID·비밀값은 들어 있지 않습니다. 두 표 모두 서버 함수(전용 키)만 읽고 쓰며 공개 권한은 모두 회수합니다.
begin;

-- 사본: 메모 한 건당 한 행. content_hash = SHA-256(JSON {"title":…,"body":…}) 소문자 16진수 64자
-- (src/memo-restore.mjs의 contentHashOf와 같은 값). 사본은 침해 전에 만들고 이후 고치지 않습니다.
create table if not exists public.memo_backups (
  memo_id uuid primary key,
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 5000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  backed_up_at timestamptz not null default now()
);

-- 감사 기록: 덧붙이기만 가능합니다. 고치거나 지우려는 시도는 트리거가 막습니다. 내용은 담지 않고 해시와 결과만 남깁니다.
create table if not exists public.memo_restore_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null,
  memo_id uuid not null,
  owner_id uuid not null,
  content_hash text,
  outcome text not null check (outcome ~ '^[a-z_]{1,40}$')
);

create or replace function public.memo_restore_audit_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'memo_restore_audit is append-only';
end $$;

drop trigger if exists memo_restore_audit_no_change on public.memo_restore_audit;
create trigger memo_restore_audit_no_change
  before update or delete or truncate on public.memo_restore_audit
  for each statement execute function public.memo_restore_audit_append_only();

alter table public.memo_backups enable row level security;
alter table public.memo_restore_audit enable row level security;
revoke all on table public.memo_backups from public, anon, authenticated;
revoke all on table public.memo_restore_audit from public, anon, authenticated;

commit;

-- 정상 결과: 두 표 모두 rls_on = true, anon·authenticated 권한 없음.
select relname, relrowsecurity as rls_on from pg_class
where oid in ('public.memo_backups'::regclass, 'public.memo_restore_audit'::regclass);
