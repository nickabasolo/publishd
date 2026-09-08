-- Phase 5 fix: `_do_publish` (0010_publish_pipeline.sql) set the chapter's
-- state/number/published_at and fanned out notifications, but never flipped
-- `stories.is_published`. Since the reader-facing RLS policy on stories
-- ("published stories are public, drafts are author-only", 0009_rls.sql)
-- gates story visibility on that flag, a story's first chapter publish left
-- the story invisible to everyone but its author. The Phase 3 adapter
-- (src/lib/data/supabase/client.ts, studio.setChapterState) worked around
-- this client-side with a follow-up `update stories set is_published = true`
-- after calling `publish_chapter` — a real gap, since the RPC could succeed
-- while that second write failed, leaving a published chapter whose story is
-- still invisible.
--
-- Fixing it here, in `_do_publish` itself, makes the whole thing atomic
-- again: one transaction, one code path, both call sites (publish_chapter
-- and the cron sweep) covered. The client-side workaround is removed in the
-- same change (see src/lib/data/supabase/client.ts).

create or replace function public._do_publish(p_chapter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story_id uuid;
  v_author_id uuid;
  v_next_number int;
  v_number int;
  v_published_at timestamptz;
begin
  select c.story_id, c.number, c.published_at, s.author_id
    into v_story_id, v_number, v_published_at, v_author_id
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where c.id = p_chapter_id
  for update of c;

  if not found then
    raise exception 'chapter % not found', p_chapter_id;
  end if;

  -- Serialize concurrent publishes for the same story so "max(number)+1" is
  -- race-free without needing a lockable row when the story has zero
  -- published chapters yet.
  perform pg_advisory_xact_lock(hashtext(v_story_id::text));

  if v_number is null then
    select coalesce(max(number), 0) + 1
      into v_next_number
    from public.chapters
    where story_id = v_story_id and state = 'published';
  else
    v_next_number := v_number;
  end if;

  update public.chapters
  set state = 'published',
      number = v_next_number,
      published_at = coalesce(v_published_at, now()),
      scheduled_at = null,
      updated_at = now()
  where id = p_chapter_id;

  -- The fix: a story's first published chapter must flip is_published, or
  -- RLS hides the story from everyone but its author.
  update public.stories
  set is_published = true,
      updated_at = now()
  where id = v_story_id;

  insert into public.notifications (profile_id, type, actor_id, story_id, chapter_id)
  select sf.profile_id, 'chapter_published', v_author_id, v_story_id, p_chapter_id
  from public.story_follows sf
  where sf.target_id = v_story_id
    and sf.profile_id <> v_author_id;
end;
$$;

revoke all on function public._do_publish(uuid) from public;
grant execute on function public._do_publish(uuid) to authenticated;
