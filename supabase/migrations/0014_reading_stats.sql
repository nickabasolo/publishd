-- Phase 5: real reading stats, to back `profiles.getStats` / `getMyStats`
-- (left as `notImplemented` in Phase 3 — see src/lib/data/supabase/client.ts).
--
-- `read_events` and `reading_progress` are both RLS-private to their owner
-- (0009_rls.sql), so a public "view someone else's stats" call can't just
-- select the tables directly — it goes through a security-definer RPC that
-- returns only aggregate counts, never raw rows, which keeps the privacy
-- boundary intact while still letting a profile page show real numbers.
--
-- `minutesRead` has no backing data: `read_events` records no dwell/duration
-- column (flagged in the plan's schema section — only `started_at` and a
-- `completed` flag exist), so it is honestly reported as 0 rather than
-- fabricated. Real dwell tracking is instrumentation scope (Phase 6), not
-- this phase.
--
-- Also closes a gap flagged by the Phase 3/4 agent: `reading.completeChapter`
-- (src/lib/data/supabase/client.ts) could flip `reading_progress.completed`
-- but had no way to flip the matching `read_events` row's `completed` to
-- true, since read_events has no client update policy by design. That RPC
-- is added here (`complete_read_event`) and wired up in the same client.ts
-- change.

-- =============================================================================
-- complete_read_event(chapter_id) — marks the caller's most recent read
-- event for this chapter completed. SECURITY DEFINER so it can update a
-- table with no client update policy; scoped to auth.uid() internally so it
-- can only ever touch the caller's own rows.
-- =============================================================================

create or replace function public.complete_read_event(p_chapter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.read_events
  set completed = true
  where id = (
    select id
    from public.read_events
    where profile_id = auth.uid()
      and chapter_id = p_chapter_id
    order by started_at desc
    limit 1
  );
end;
$$;

revoke all on function public.complete_read_event(uuid) from public;
grant execute on function public.complete_read_event(uuid) to authenticated;

-- =============================================================================
-- get_my_reading_stats() — the signed-in caller's own reading stats.
-- =============================================================================

create or replace function public.get_my_reading_stats()
returns table (books_read int, chapters_read int, minutes_read int, day_streak int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_books int;
  v_chapters int;
  v_streak int := 0;
  v_last_day date;
  v_cursor date;
begin
  if v_profile_id is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  select count(distinct story_id) into v_books
  from public.reading_progress
  where profile_id = v_profile_id and completed = true;

  select count(distinct chapter_id) into v_chapters
  from public.read_events
  where profile_id = v_profile_id and completed = true;

  -- Current streak: consecutive calendar days with at least one read event,
  -- counting back from the most recent active day. If that day is older
  -- than yesterday the streak has lapsed and reads as 0 (Duolingo-style: a
  -- missed day resets it, but "today" hasn't closed out yet so yesterday
  -- still counts).
  select max(started_at::date) into v_last_day
  from public.read_events
  where profile_id = v_profile_id;

  if v_last_day is not null and v_last_day >= (current_date - 1) then
    v_cursor := v_last_day;
    while exists (
      select 1 from public.read_events
      where profile_id = v_profile_id and started_at::date = v_cursor
    ) loop
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    end loop;
  end if;

  return query select coalesce(v_books, 0), coalesce(v_chapters, 0), 0, coalesce(v_streak, 0);
end;
$$;

revoke all on function public.get_my_reading_stats() from public;
grant execute on function public.get_my_reading_stats() to authenticated;

-- =============================================================================
-- get_reading_stats(handle) — public view of any profile's reading stats
-- (aggregate counts only, never raw read_events/reading_progress rows).
-- Callable by anon too, matching profiles.getByHandle's public-select
-- semantics (guests browse author/reader pages).
-- =============================================================================

create or replace function public.get_reading_stats(p_handle text)
returns table (books_read int, chapters_read int, minutes_read int, day_streak int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_books int;
  v_chapters int;
  v_streak int := 0;
  v_last_day date;
  v_cursor date;
begin
  select id into v_profile_id
  from public.profiles
  where lower(username) = lower(p_handle);

  if v_profile_id is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  select count(distinct story_id) into v_books
  from public.reading_progress
  where profile_id = v_profile_id and completed = true;

  select count(distinct chapter_id) into v_chapters
  from public.read_events
  where profile_id = v_profile_id and completed = true;

  select max(started_at::date) into v_last_day
  from public.read_events
  where profile_id = v_profile_id;

  if v_last_day is not null and v_last_day >= (current_date - 1) then
    v_cursor := v_last_day;
    while exists (
      select 1 from public.read_events
      where profile_id = v_profile_id and started_at::date = v_cursor
    ) loop
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    end loop;
  end if;

  return query select coalesce(v_books, 0), coalesce(v_chapters, 0), 0, coalesce(v_streak, 0);
end;
$$;

revoke all on function public.get_reading_stats(text) from public;
grant execute on function public.get_reading_stats(text) to authenticated, anon;
