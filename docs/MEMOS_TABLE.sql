-- 3단계: 로그인한 사용자의 메모 테이블. Supabase 대시보드의 SQL Editor에서 한 번 실행합니다.
-- 메모 본문이나 비밀값은 들어 있지 않습니다. 서버 함수(전용 키)만 읽고 쓰도록 공개 권한은 모두 회수합니다.
create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memos_owner_id_idx on public.memos (owner_id);

alter table public.memos enable row level security;
revoke all on public.memos from anon, authenticated;
