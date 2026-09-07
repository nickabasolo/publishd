-- Notifications: client-readable, but never client-writable.
-- Rows are created only by security-definer triggers, wired up in Phase 5
-- (chapter published -> fan out to story_follows; comment inserted -> notify
-- parent author or story author; follow -> notify followee). This migration
-- creates the table and type constraint only.
-- RLS policies are centralized in 0009_rls.sql.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (
    type in (
      'chapter_published',
      'comment_reply',
      'comment_on_story',
      'story_followed',
      'author_followed'
    )
  ),
  actor_id uuid references public.profiles (id) on delete set null,
  story_id uuid references public.stories (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_id_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (profile_id)
  where read_at is null;
