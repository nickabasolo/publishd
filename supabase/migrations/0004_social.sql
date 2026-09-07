-- Social: comments (one-level nesting), likes, follows.
-- RLS policies for these tables are centralized in 0009_rls.sql.

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  -- null = chapter-level comment; non-null anchors to a specific paragraph.
  paragraph_id uuid references public.paragraphs (id) on delete set null,
  -- null = top-level comment; non-null = a reply (exactly one level deep,
  -- enforced by the trigger below since a CHECK can't subquery).
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  -- First ~200 chars of the anchored paragraph, captured at insert time, so
  -- a comment stays legible even after its paragraph is edited or removed.
  body_snapshot text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index comments_chapter_id_idx on public.comments (chapter_id);
create index comments_paragraph_id_idx on public.comments (paragraph_id);
create index comments_parent_id_idx on public.comments (parent_id);
create index comments_author_id_idx on public.comments (author_id);

-- One-level nesting: reject a parent_id that itself points at a reply.
create or replace function public.enforce_one_level_comment_nesting()
returns trigger
language plpgsql
as $$
declare
  parent_parent_id uuid;
begin
  if new.parent_id is not null then
    select parent_id into parent_parent_id
    from public.comments
    where id = new.parent_id;

    if not found then
      raise exception 'parent comment % does not exist', new.parent_id;
    end if;

    if parent_parent_id is not null then
      raise exception 'comments may only be nested one level deep';
    end if;
  end if;

  return new;
end;
$$;

create trigger comments_one_level_nesting
  before insert on public.comments
  for each row execute function public.enforce_one_level_comment_nesting();

-- ---------------------------------------------------------------------------

create table public.story_likes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, target_id)
);

create index story_likes_target_id_idx on public.story_likes (target_id);

create table public.paragraph_likes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.paragraphs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, target_id)
);

create index paragraph_likes_target_id_idx on public.paragraph_likes (target_id);

create table public.story_follows (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, target_id)
);

create index story_follows_target_id_idx on public.story_follows (target_id);

create table public.author_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  check (follower_id <> author_id)
);

create index author_follows_author_id_idx on public.author_follows (author_id);
