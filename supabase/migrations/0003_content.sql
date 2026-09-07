-- Content: stories, tags, story_tags, chapters, paragraphs.
-- RLS policies for these tables are centralized in 0009_rls.sql.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  blurb text not null default '',
  synopsis text not null default '',
  cover_color text not null default '#6366f1',
  status text not null default 'ongoing' check (status in ('ongoing', 'complete')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index stories_slug_key on public.stories (slug);
create index stories_author_id_idx on public.stories (author_id);
-- Discover feed sort key: published stories, most-recently-updated first.
create index stories_published_updated_idx
  on public.stories (updated_at desc)
  where is_published;

-- ---------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  -- The matching key. Enforced lowercase at the DB level, not just by
  -- convention, since this table exists specifically to fix a casing bug
  -- (see plan: "Content" section on tags) — a stray uppercase slug would
  -- silently reintroduce it.
  slug text not null check (slug = lower(slug)),
  display_name text not null,
  created_at timestamptz not null default now()
);

create unique index tags_slug_key on public.tags (slug);

create table public.story_tags (
  story_id uuid not null references public.stories (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (story_id, tag_id)
);

create index story_tags_tag_id_idx on public.story_tags (tag_id);

-- ---------------------------------------------------------------------------

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  -- Nullable: assigned only at publish time (see publish_chapter, Phase 4),
  -- never renumbered afterward. This is what keeps comment/notification
  -- anchors stable across hides and future chapter edits.
  number integer,
  title text not null default '',
  state text not null default 'draft' check (state in ('draft', 'scheduled', 'published')),
  -- Author-side retraction of a published chapter. Reversible; does not
  -- affect `number`, paragraphs, comments, or analytics. See publish
  -- pipeline notes in the project plan.
  hidden boolean not null default false,
  locked boolean not null default false,
  scheduled_at timestamptz,
  published_at timestamptz,
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A chapter number is only meaningful (and only unique) once published.
create unique index chapters_story_number_published_key
  on public.chapters (story_id, number)
  where state = 'published';

-- Feeds the pg_cron sweep in publish_due_chapters (Phase 4).
create index chapters_scheduled_idx
  on public.chapters (scheduled_at)
  where state = 'scheduled';

create index chapters_story_id_idx on public.chapters (story_id);

-- ---------------------------------------------------------------------------

create table public.paragraphs (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  -- Dense, 0-based among non-deleted paragraphs for a given chapter.
  ordinal integer not null,
  body text not null,
  -- Soft delete: keeps the id alive so existing comments stay legible via
  -- their `body_snapshot` even after the paragraph they anchored is gone.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index paragraphs_chapter_ordinal_key
  on public.paragraphs (chapter_id, ordinal)
  where deleted_at is null;

create index paragraphs_chapter_id_idx on public.paragraphs (chapter_id);

-- Trigram index to support the Phase 4 paragraph-diff similarity matching
-- (pg_trgm's `similarity()` / `%` operator over paragraph body text).
-- Unqualified opclass name: Supabase-hosted Postgres puts the `extensions`
-- schema (where pg_trgm lives) on every role's search_path by default.
create index paragraphs_body_trgm_idx
  on public.paragraphs using gin (body gin_trgm_ops);
