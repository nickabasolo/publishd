-- Moderation: reports. Triage happens via Supabase Studio for MVP — no admin UI.
-- RLS policies are centralized in 0009_rls.sql.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('story', 'chapter', 'comment', 'profile')),
  target_id uuid not null,
  reason text not null,
  detail text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index reports_target_idx on public.reports (target_type, target_id);
create index reports_status_idx on public.reports (status);
