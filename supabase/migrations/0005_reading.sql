-- Reading: per-reader progress, append-only read events.
-- RLS policies for these tables are centralized in 0009_rls.sql.

create table public.reading_progress (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  -- Denormalized so progress survives the referenced chapter being deleted
  -- (never-published chapters can be hard-deleted; see publish pipeline).
  chapter_number integer,
  paragraph_ordinal integer,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, story_id)
);

create index reading_progress_story_id_idx on public.reading_progress (story_id);

-- ---------------------------------------------------------------------------

create table public.read_events (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: guest reads have no profile, only a client-generated session id.
  profile_id uuid references public.profiles (id) on delete set null,
  session_id text not null,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed boolean not null default false
);

create index read_events_story_id_idx on public.read_events (story_id);
create index read_events_chapter_id_idx on public.read_events (chapter_id);
create index read_events_profile_id_idx on public.read_events (profile_id);
