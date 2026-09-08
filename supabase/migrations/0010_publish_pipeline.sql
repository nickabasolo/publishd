-- Phase 4: the publish pipeline.
--
-- save_chapter_draft: the paragraph diff (see plan, "Paragraph identity").
-- publish_chapter / schedule_chapter / set_chapter_hidden / unpublish_chapter:
-- the state machine described in "Publish pipeline", all funneled through a
-- single internal `_do_publish` so there is exactly one publish code path.
-- publish_due_chapters + pg_cron: the scheduled sweep.
-- Plus: enforce that a comment's paragraph_id actually belongs to its
-- chapter_id (flagged in Phase 0 review as belonging here).

-- =============================================================================
-- save_chapter_draft(chapter_id, title, plain_text, locked)
--
-- Runs SECURITY INVOKER (as the calling author) — the existing RLS ownership
-- policies on chapters/paragraphs are the real enforcement; the explicit
-- check below just gives a clean error instead of a silent zero-row RLS
-- failure deep in the diff logic.
--
-- Two-pass diff:
--   1. Exact-match LCS over old/new paragraph bodies. Matched pairs keep
--      their id outright — no text changed, nothing to update.
--   2. For paragraphs left unmatched by pass 1, walk the "gaps" between
--      consecutive pass-1 anchors (and the leading/trailing gap) and pair
--      old/new paragraphs *positionally within that gap* using pg_trgm
--      `similarity()`. >= 0.6 is treated as the same paragraph edited (id
--      kept, body + updated_at updated); below it, the old paragraph is
--      unmatched (soft-deleted) and the new one is unmatched (inserted).
--
-- Ordinals are recomputed densely (0-based) across the final survivor order
-- at the end, in three steps to avoid the partial-unique-index swap problem:
-- free vacated ordinals (soft-delete), push survivors out of the way with a
-- constant offset, then insert new rows and re-home survivors into the
-- (now-disjoint) final ordinal set.
-- =============================================================================

create or replace function public.save_chapter_draft(
  p_chapter_id uuid,
  p_title text,
  p_plain_text text,
  p_locked boolean default null
) returns void
language plpgsql
as $$
declare
  v_old_ids uuid[];
  v_old_bodies text[];
  v_new_bodies text[];
  v_raw text[];
  v_trimmed text;
  n int;
  m int;
  dp int[];
  matched_old_for_new int[]; -- 1..m -> old index (1..n) or null
  i int;
  j int;
  k int;
  prev_old int := 0;
  prev_new int := 0;
  gap_old_len int;
  gap_new_len int;
  gap_min int;
  old_idx int;
  new_idx int;
  sim double precision;
  matched_old_ids uuid[];
  kept_ids uuid[] := array[]::uuid[];
  kept_ordinals int[] := array[]::int[];
  kept_bodies text[] := array[]::text[];
  insert_ordinals int[] := array[]::int[];
  insert_bodies text[] := array[]::text[];
  ordinal_counter int := 0;
  v_word_count int := 0;
  b text;
begin
  if not exists (
    select 1
    from public.chapters c
    join public.stories s on s.id = c.story_id
    where c.id = p_chapter_id and s.author_id = auth.uid()
  ) then
    raise exception 'chapter % not found or not owned by caller', p_chapter_id;
  end if;

  -- ---- split, same rule as bodyToParagraphs: split on blank lines, trim, drop empties.
  v_raw := regexp_split_to_array(coalesce(p_plain_text, ''), '\n\s*\n');
  foreach v_trimmed in array v_raw loop
    v_trimmed := btrim(v_trimmed);
    if v_trimmed <> '' then
      v_new_bodies := array_append(v_new_bodies, v_trimmed);
      v_word_count := v_word_count + coalesce(array_length(regexp_split_to_array(v_trimmed, '\s+'), 1), 0);
    end if;
  end loop;
  v_new_bodies := coalesce(v_new_bodies, array[]::text[]);

  select coalesce(array_agg(id order by ordinal), array[]::uuid[]),
         coalesce(array_agg(body order by ordinal), array[]::text[])
    into v_old_ids, v_old_bodies
  from public.paragraphs
  where chapter_id = p_chapter_id and deleted_at is null;

  n := coalesce(array_length(v_old_ids, 1), 0);
  m := coalesce(array_length(v_new_bodies, 1), 0);

  -- ---- pass 1: exact-match LCS.
  -- Explicit 0-based lower bounds so dp[0][*] / dp[*][0] are real
  -- zero-valued border cells, not out-of-range NULLs (array_fill defaults
  -- to a lower bound of 1, which would silently corrupt the i=1/j=1 case).
  dp := array_fill(0, array[n + 1, m + 1], array[0, 0]);
  for i in 1..n loop
    for j in 1..m loop
      if v_old_bodies[i] = v_new_bodies[j] then
        dp[i][j] := dp[i - 1][j - 1] + 1;
      else
        dp[i][j] := greatest(dp[i - 1][j], dp[i][j - 1]);
      end if;
    end loop;
  end loop;

  matched_old_for_new := array_fill(null::int, array[m]);
  i := n;
  j := m;
  while i > 0 and j > 0 loop
    if v_old_bodies[i] = v_new_bodies[j] then
      matched_old_for_new[j] := i;
      i := i - 1;
      j := j - 1;
    elsif dp[i - 1][j] >= dp[i][j - 1] then
      i := i - 1;
    else
      j := j - 1;
    end if;
  end loop;

  -- ---- pass 2: similarity match within each gap between pass-1 anchors.
  j := 1;
  while j <= m + 1 loop
    if j <= m and matched_old_for_new[j] is not null then
      gap_old_len := matched_old_for_new[j] - 1 - prev_old;
      gap_new_len := j - 1 - prev_new;
      gap_min := least(gap_old_len, gap_new_len);
      for k in 1..gap_min loop
        old_idx := prev_old + k;
        new_idx := prev_new + k;
        sim := similarity(v_old_bodies[old_idx], v_new_bodies[new_idx]);
        if sim >= 0.6 then
          matched_old_for_new[new_idx] := old_idx;
        end if;
      end loop;
      prev_old := matched_old_for_new[j];
      prev_new := j;
    elsif j = m + 1 then
      gap_old_len := n - prev_old;
      gap_new_len := m - prev_new;
      gap_min := least(gap_old_len, gap_new_len);
      for k in 1..gap_min loop
        old_idx := prev_old + k;
        new_idx := prev_new + k;
        sim := similarity(v_old_bodies[old_idx], v_new_bodies[new_idx]);
        if sim >= 0.6 then
          matched_old_for_new[new_idx] := old_idx;
        end if;
      end loop;
    end if;
    j := j + 1;
  end loop;

  -- ---- build final kept/insert sets in final ordinal order.
  for j in 1..m loop
    if matched_old_for_new[j] is not null then
      kept_ids := array_append(kept_ids, v_old_ids[matched_old_for_new[j]]);
      kept_ordinals := array_append(kept_ordinals, ordinal_counter);
      kept_bodies := array_append(kept_bodies, v_new_bodies[j]);
    else
      insert_ordinals := array_append(insert_ordinals, ordinal_counter);
      insert_bodies := array_append(insert_bodies, v_new_bodies[j]);
    end if;
    ordinal_counter := ordinal_counter + 1;
  end loop;

  matched_old_ids := coalesce(
    (select array_agg(v_old_ids[x]) from unnest(matched_old_for_new) as x where x is not null),
    array[]::uuid[]
  );

  -- ---- 1. free vacated ordinals: soft-delete anything not carried forward.
  update public.paragraphs
  set deleted_at = now()
  where chapter_id = p_chapter_id
    and deleted_at is null
    and not (id = any(matched_old_ids));

  -- ---- 2. push survivors out of the way of the target ordinal range.
  update public.paragraphs
  set ordinal = ordinal + 1000000
  where chapter_id = p_chapter_id
    and deleted_at is null;

  -- ---- 3. insert genuinely new paragraphs at their final ordinals.
  insert into public.paragraphs (chapter_id, ordinal, body)
  select p_chapter_id, o, b
  from unnest(insert_ordinals, insert_bodies) as t(o, b);

  -- ---- 4. re-home survivors to their final ordinal, updating body/updated_at
  --         only where the body actually changed (similarity-matched edits).
  for i in 1..coalesce(array_length(kept_ids, 1), 0) loop
    update public.paragraphs
    set ordinal = kept_ordinals[i],
        body = kept_bodies[i],
        updated_at = case when body <> kept_bodies[i] then now() else updated_at end
    where id = kept_ids[i];
  end loop;

  update public.chapters
  set title = coalesce(p_title, title),
      locked = coalesce(p_locked, locked),
      word_count = v_word_count,
      updated_at = now()
  where id = p_chapter_id;
end;
$$;

revoke all on function public.save_chapter_draft(uuid, text, text, boolean) from public;
grant execute on function public.save_chapter_draft(uuid, text, text, boolean) to authenticated;

-- =============================================================================
-- _do_publish(id) — the single publish code path shared by publish_chapter
-- and the pg_cron sweep. SECURITY DEFINER because the notification fan-out
-- writes to `notifications`, which has no client insert policy by design
-- (see plan / 0009_rls.sql). EXECUTE is still restricted below so only the
-- two call sites (an authenticated author via publish_chapter, or the cron
-- sweep) can invoke it.
-- =============================================================================

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

  update public.stories
  set updated_at = now()
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

-- =============================================================================
-- publish_chapter(id) — author-facing entry point. SECURITY INVOKER: the
-- ownership check below runs as the caller, then it hands off to the one
-- shared _do_publish.
-- =============================================================================

create or replace function public.publish_chapter(p_chapter_id uuid)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.chapters c
    join public.stories s on s.id = c.story_id
    where c.id = p_chapter_id and s.author_id = auth.uid()
  ) then
    raise exception 'chapter % not found or not owned by caller', p_chapter_id;
  end if;

  perform public._do_publish(p_chapter_id);
end;
$$;

revoke all on function public.publish_chapter(uuid) from public;
grant execute on function public.publish_chapter(uuid) to authenticated;

-- =============================================================================
-- schedule_chapter(id, at)
-- =============================================================================

create or replace function public.schedule_chapter(p_chapter_id uuid, p_at timestamptz)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.chapters c
    join public.stories s on s.id = c.story_id
    where c.id = p_chapter_id and s.author_id = auth.uid()
  ) then
    raise exception 'chapter % not found or not owned by caller', p_chapter_id;
  end if;

  update public.chapters
  set state = 'scheduled',
      scheduled_at = p_at,
      updated_at = now()
  where id = p_chapter_id
    and state in ('draft', 'scheduled');

  if not found then
    raise exception 'chapter % is not in a schedulable state', p_chapter_id;
  end if;
end;
$$;

revoke all on function public.schedule_chapter(uuid, timestamptz) from public;
grant execute on function public.schedule_chapter(uuid, timestamptz) to authenticated;

-- =============================================================================
-- set_chapter_hidden(id, hidden) — retract/restore a published chapter
-- without touching its number, paragraphs, comments, or analytics.
-- =============================================================================

create or replace function public.set_chapter_hidden(p_chapter_id uuid, p_hidden boolean)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.chapters c
    join public.stories s on s.id = c.story_id
    where c.id = p_chapter_id and s.author_id = auth.uid()
  ) then
    raise exception 'chapter % not found or not owned by caller', p_chapter_id;
  end if;

  update public.chapters
  set hidden = p_hidden,
      updated_at = now()
  where id = p_chapter_id
    and state = 'published';

  if not found then
    raise exception 'chapter % is not published, so it cannot be hidden/unhidden', p_chapter_id;
  end if;
end;
$$;

revoke all on function public.set_chapter_hidden(uuid, boolean) from public;
grant execute on function public.set_chapter_hidden(uuid, boolean) to authenticated;

-- =============================================================================
-- unpublish_chapter(id) — only the most recently published chapter of its
-- story may be unpublished (reverted to draft, number cleared), since a
-- `number` once assigned to any earlier chapter must never change.
-- =============================================================================

create or replace function public.unpublish_chapter(p_chapter_id uuid)
returns void
language plpgsql
as $$
declare
  v_story_id uuid;
  v_number int;
  v_max_number int;
begin
  select c.story_id, c.number
    into v_story_id, v_number
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where c.id = p_chapter_id and s.author_id = auth.uid();

  if not found then
    raise exception 'chapter % not found or not owned by caller', p_chapter_id;
  end if;

  if v_number is null then
    raise exception 'chapter % is not published', p_chapter_id;
  end if;

  select max(number) into v_max_number
  from public.chapters
  where story_id = v_story_id and state = 'published';

  if v_number <> v_max_number then
    raise exception 'only the most recently published chapter may be unpublished';
  end if;

  update public.chapters
  set state = 'draft',
      number = null,
      published_at = null,
      updated_at = now()
  where id = p_chapter_id;
end;
$$;

revoke all on function public.unpublish_chapter(uuid) from public;
grant execute on function public.unpublish_chapter(uuid) to authenticated;

-- =============================================================================
-- publish_due_chapters() + pg_cron sweep, every minute. `for update skip
-- locked` so overlapping runs (or a run overlapping a manual publish) never
-- block on each other.
-- =============================================================================

create or replace function public.publish_due_chapters()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select id
    from public.chapters
    where state = 'scheduled' and scheduled_at <= now()
    for update skip locked
  loop
    perform public._do_publish(rec.id);
  end loop;
end;
$$;

revoke all on function public.publish_due_chapters() from public;

select cron.schedule(
  'publish-due-chapters',
  '* * * * *',
  $$select public.publish_due_chapters();$$
);

-- =============================================================================
-- Enforce that a comment's paragraph_id actually belongs to its chapter_id.
-- Flagged in the Phase 0 review as belonging here (Phase 4), since it's part
-- of keeping paragraph anchors trustworthy.
-- =============================================================================

create or replace function public.enforce_comment_paragraph_chapter_match()
returns trigger
language plpgsql
as $$
declare
  v_paragraph_chapter_id uuid;
begin
  if new.paragraph_id is not null then
    select chapter_id into v_paragraph_chapter_id
    from public.paragraphs
    where id = new.paragraph_id;

    if not found then
      raise exception 'paragraph % does not exist', new.paragraph_id;
    end if;

    if v_paragraph_chapter_id <> new.chapter_id then
      raise exception 'paragraph % does not belong to chapter %', new.paragraph_id, new.chapter_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger comments_paragraph_chapter_match
  before insert or update on public.comments
  for each row execute function public.enforce_comment_paragraph_chapter_match();
