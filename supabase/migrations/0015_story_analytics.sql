-- Phase 8 part 2: real per-story analytics, backed by actual aggregate
-- queries against read_events/comments/likes/follows — replaces
-- src/lib/story-analytics.ts's hash-fabricated numbers.
--
-- Author-only. `read_events` is RLS-private to its own profile_id (0009_rls.sql),
-- so a query scoped to "every read of my story, by any reader" can't be
-- expressed as a direct client-side select under RLS at all — it has to go
-- through a security-definer RPC that checks story ownership internally and
-- returns only aggregates, never raw read_events/reading_progress rows,
-- matching the same privacy pattern as get_my_reading_stats/get_reading_stats
-- (0014_reading_stats.sql).

create or replace function public.get_story_analytics(p_story_slug text)
returns table (
  total_reads bigint,
  likes bigint,
  comments bigint,
  subscribers bigint,
  completion_rate double precision,
  reads_by_chapter jsonb,
  reads_last_30 jsonb,
  top_passages jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story_id uuid;
  v_author_id uuid;
begin
  select id, author_id into v_story_id, v_author_id
  from public.stories
  where slug = p_story_slug;

  -- No such story, or the caller isn't its author: return nothing rather
  -- than raising, so the client can treat "no rows" the same as `null`
  -- (mirrors the `T | null` convention used throughout the data contract).
  if v_story_id is null or auth.uid() is null or auth.uid() <> v_author_id then
    return;
  end if;

  return query
  with chapter_reads as (
    select c.id as chapter_id, c.number, count(re.id) as reads
    from public.chapters c
    left join public.read_events re on re.chapter_id = c.id
    where c.story_id = v_story_id and c.state = 'published'
    group by c.id, c.number
    order by c.number
  ),
  daily_reads as (
    select d::date as day, count(re.id) as reads
    from generate_series(current_date - 29, current_date, interval '1 day') d
    left join public.read_events re
      on re.story_id = v_story_id and re.started_at::date = d::date
    group by d
    order by d
  ),
  passage_likes as (
    select c.number as chapter_number, p.ordinal as paragraph_ordinal, count(pl.profile_id) as like_count
    from public.paragraphs p
    join public.chapters c on c.id = p.chapter_id
    join public.paragraph_likes pl on pl.target_id = p.id
    where c.story_id = v_story_id and p.deleted_at is null
    group by c.number, p.ordinal
    order by like_count desc
    limit 4
  )
  select
    coalesce((select count(*) from public.read_events where story_id = v_story_id), 0),
    coalesce((select count(*) from public.story_likes where target_id = v_story_id), 0),
    coalesce((
      select count(*) from public.comments cm
      join public.chapters c on c.id = cm.chapter_id
      where c.story_id = v_story_id and cm.deleted_at is null
    ), 0),
    coalesce((select count(*) from public.story_follows where target_id = v_story_id), 0),
    coalesce((
      select avg(case when completed then 1.0 else 0.0 end)
      from public.read_events where story_id = v_story_id
    ), 0),
    coalesce((
      select jsonb_agg(jsonb_build_object('label', number::text, 'value', reads) order by number)
      from chapter_reads
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(reads order by day)
      from daily_reads
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('chapter', chapter_number, 'paragraph', paragraph_ordinal, 'likes', like_count))
      from passage_likes
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_story_analytics(text) from public;
grant execute on function public.get_story_analytics(text) to authenticated;
