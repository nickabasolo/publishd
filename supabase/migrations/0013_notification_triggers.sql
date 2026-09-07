-- Phase 5: notification triggers.
--
-- `notifications` has no client insert policy (0009_rls.sql) — every row is
-- created by a security-definer trigger, per the plan's "Notifications &
-- moderation" section:
--   - chapter published -> fan out to story_follows              (already
--     done inside _do_publish, 0010/0012 — nothing to add here)
--   - comment inserted  -> notify parent comment's author (reply) or the
--     story's author (top-level); never notify someone about their own
--     comment
--   - a follow (story_follows / author_follows) insert -> notify the
--     followee, never the follower notifying themselves

-- =============================================================================
-- comments -> comment_reply / comment_on_story
-- =============================================================================

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story_id uuid;
  v_story_author_id uuid;
  v_parent_author_id uuid;
begin
  select c.story_id, s.author_id
    into v_story_id, v_story_author_id
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where c.id = new.chapter_id;

  if new.parent_id is not null then
    -- Reply: notify the parent comment's author, never the story's author
    -- just because they happen to also be reading the thread.
    select author_id into v_parent_author_id
    from public.comments
    where id = new.parent_id;

    if v_parent_author_id is not null and v_parent_author_id <> new.author_id then
      insert into public.notifications (profile_id, type, actor_id, story_id, chapter_id, comment_id)
      values (v_parent_author_id, 'comment_reply', new.author_id, v_story_id, new.chapter_id, new.id);
    end if;
  else
    -- Top-level comment: notify the story's author.
    if v_story_author_id is not null and v_story_author_id <> new.author_id then
      insert into public.notifications (profile_id, type, actor_id, story_id, chapter_id, comment_id)
      values (v_story_author_id, 'comment_on_story', new.author_id, v_story_id, new.chapter_id, new.id);
    end if;
  end if;

  return new;
end;
$$;

create trigger comments_notify_after_insert
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- =============================================================================
-- story_follows -> story_followed
-- =============================================================================

create or replace function public.notify_on_story_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id
  from public.stories
  where id = new.target_id;

  if v_author_id is not null and v_author_id <> new.profile_id then
    insert into public.notifications (profile_id, type, actor_id, story_id)
    values (v_author_id, 'story_followed', new.profile_id, new.target_id);
  end if;

  return new;
end;
$$;

create trigger story_follows_notify_after_insert
  after insert on public.story_follows
  for each row execute function public.notify_on_story_follow();

-- =============================================================================
-- author_follows -> author_followed
-- (self-follow is already impossible: `check (follower_id <> author_id)`
-- on the table, 0004_social.sql — no extra guard needed here, but keeping
-- the same defensive shape as the story-follow trigger for consistency.)
-- =============================================================================

create or replace function public.notify_on_author_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id <> new.follower_id then
    insert into public.notifications (profile_id, type, actor_id)
    values (new.author_id, 'author_followed', new.follower_id);
  end if;

  return new;
end;
$$;

create trigger author_follows_notify_after_insert
  after insert on public.author_follows
  for each row execute function public.notify_on_author_follow();
