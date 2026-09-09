-- Chat/Text-AU story format (see plan: "Quick-write flow + Chat/Text-AU story
-- format", section 1. Migration).
--
-- Additive only: every existing story/chapter/paragraph defaults to
-- unaffected ('prose') behavior.
--
-- 1. `stories.format` — chosen once per story, for its whole lifetime.
-- 2. `stories.chat_participants` — the two-person label/color map, null for
--    prose stories.
-- 3. `paragraphs.speaker` — null for every prose paragraph, forever. Only
--    meaningful when the parent story's format = 'chat'.
-- 4. `save_chat_chapter_draft` — a sibling to `save_chapter_draft` (Phase 4,
--    0010/0011), reusing the exact same two-pass diff structure (exact-match
--    LCS, then pg_trgm similarity >= 0.6 within the pass-1 gaps), same
--    ordinal-reshuffle write-back, same ownership check, same
--    security-invoker + revoke/grant pattern. The one substantive change:
--    equality/similarity in *both* passes also requires the speaker to
--    match — a message keeps its id/anchor only if both its text and its
--    speaker are unchanged. A speaker change is always delete-old +
--    insert-new, never a silent reassignment.
-- 5. `save_chapter_draft` gains a symmetric guard (re-created here via
--    `create or replace function`, not by editing 0010/0011 directly) so it
--    rejects calls against a chat-format story, and `save_chat_chapter_draft`
--    rejects calls against a prose-format story. Cheap defense-in-depth so
--    neither RPC can ever be called against the wrong format.

alter table public.stories
  add column format text not null default 'prose' check (format in ('prose', 'chat'));

alter table public.stories
  add column chat_participants jsonb;
  -- {"a": {"name": "...", "color": "..."}, "b": {"name": "...", "color": "..."}}
  -- null for prose stories.

alter table public.paragraphs
  add column speaker text check (speaker is null or speaker in ('a', 'b'));
  -- null for every prose paragraph, forever. Only meaningful when the parent
  -- story.format = 'chat'.

-- =============================================================================
-- save_chapter_draft(chapter_id, title, plain_text, locked) — re-created
-- identically to 0011's version, plus one added guard: reject calls against
-- a chat-format story. No other behavior changes.
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
  v_format text;
begin
  select s.format into v_format
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where c.id = p_chapter_id and s.author_id = auth.uid();

  if not found then
    raise exception 'chapter % not found or not owned by caller', p_chapter_id;
  end if;

  if v_format = 'chat' then
    raise exception 'chapter % belongs to a chat-format story; use save_chat_chapter_draft', p_chapter_id;
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
  select p_chapter_id, t.new_ordinal, t.new_body
  from unnest(insert_ordinals, insert_bodies) as t(new_ordinal, new_body);

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
-- save_chat_chapter_draft(chapter_id, title, messages, locked) — sibling to
-- save_chapter_draft. `p_messages` is an ordered JSON array of
-- {"speaker": "a"|"b", "text": "..."}. Same two-pass diff structure, except
-- equality/similarity in both passes also requires the speaker to match:
-- a message keeps its id/anchor only if both its text (exact or similar
-- enough) AND its speaker are unchanged. A speaker change is always
-- delete-old + insert-new, never a silent reassignment.
-- =============================================================================

create or replace function public.save_chat_chapter_draft(
  p_chapter_id uuid,
  p_title text,
  p_messages jsonb,
  p_locked boolean default null
) returns void
language plpgsql
as $$
declare
  v_old_ids uuid[];
  v_old_bodies text[];
  v_old_speakers text[];
  v_new_bodies text[];
  v_new_speakers text[];
  v_trimmed text;
  v_speaker text;
  msg jsonb;
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
  kept_speakers text[] := array[]::text[];
  insert_ordinals int[] := array[]::int[];
  insert_bodies text[] := array[]::text[];
  insert_speakers text[] := array[]::text[];
  ordinal_counter int := 0;
  v_word_count int := 0;
  v_format text;
begin
  select s.format into v_format
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where c.id = p_chapter_id and s.author_id = auth.uid();

  if not found then
    raise exception 'chapter % not found or not owned by caller', p_chapter_id;
  end if;

  if v_format is distinct from 'chat' then
    raise exception 'chapter % does not belong to a chat-format story; use save_chapter_draft', p_chapter_id;
  end if;

  -- ---- flatten p_messages into parallel body/speaker arrays, dropping
  -- entries with empty text (mirrors save_chapter_draft's drop-empties rule).
  for msg in select * from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) loop
    v_trimmed := btrim(coalesce(msg->>'text', ''));
    v_speaker := msg->>'speaker';
    if v_trimmed <> '' then
      v_new_bodies := array_append(v_new_bodies, v_trimmed);
      v_new_speakers := array_append(v_new_speakers, v_speaker);
      v_word_count := v_word_count + coalesce(array_length(regexp_split_to_array(v_trimmed, '\s+'), 1), 0);
    end if;
  end loop;
  v_new_bodies := coalesce(v_new_bodies, array[]::text[]);
  v_new_speakers := coalesce(v_new_speakers, array[]::text[]);

  select coalesce(array_agg(id order by ordinal), array[]::uuid[]),
         coalesce(array_agg(body order by ordinal), array[]::text[]),
         coalesce(array_agg(speaker order by ordinal), array[]::text[])
    into v_old_ids, v_old_bodies, v_old_speakers
  from public.paragraphs
  where chapter_id = p_chapter_id and deleted_at is null;

  n := coalesce(array_length(v_old_ids, 1), 0);
  m := coalesce(array_length(v_new_bodies, 1), 0);

  -- ---- pass 1: exact-match LCS (text AND speaker must both match).
  dp := array_fill(0, array[n + 1, m + 1], array[0, 0]);
  for i in 1..n loop
    for j in 1..m loop
      if v_old_bodies[i] = v_new_bodies[j] and v_old_speakers[i] = v_new_speakers[j] then
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
    if v_old_bodies[i] = v_new_bodies[j] and v_old_speakers[i] = v_new_speakers[j] then
      matched_old_for_new[j] := i;
      i := i - 1;
      j := j - 1;
    elsif dp[i - 1][j] >= dp[i][j - 1] then
      i := i - 1;
    else
      j := j - 1;
    end if;
  end loop;

  -- ---- pass 2: similarity match within each gap between pass-1 anchors
  -- (speaker must also match; otherwise treated as delete-old + insert-new).
  j := 1;
  while j <= m + 1 loop
    if j <= m and matched_old_for_new[j] is not null then
      gap_old_len := matched_old_for_new[j] - 1 - prev_old;
      gap_new_len := j - 1 - prev_new;
      gap_min := least(gap_old_len, gap_new_len);
      for k in 1..gap_min loop
        old_idx := prev_old + k;
        new_idx := prev_new + k;
        if v_old_speakers[old_idx] = v_new_speakers[new_idx] then
          sim := similarity(v_old_bodies[old_idx], v_new_bodies[new_idx]);
          if sim >= 0.6 then
            matched_old_for_new[new_idx] := old_idx;
          end if;
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
        if v_old_speakers[old_idx] = v_new_speakers[new_idx] then
          sim := similarity(v_old_bodies[old_idx], v_new_bodies[new_idx]);
          if sim >= 0.6 then
            matched_old_for_new[new_idx] := old_idx;
          end if;
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
      kept_speakers := array_append(kept_speakers, v_new_speakers[j]);
    else
      insert_ordinals := array_append(insert_ordinals, ordinal_counter);
      insert_bodies := array_append(insert_bodies, v_new_bodies[j]);
      insert_speakers := array_append(insert_speakers, v_new_speakers[j]);
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
  insert into public.paragraphs (chapter_id, ordinal, body, speaker)
  select p_chapter_id, t.new_ordinal, t.new_body, t.new_speaker
  from unnest(insert_ordinals, insert_bodies, insert_speakers) as t(new_ordinal, new_body, new_speaker);

  -- ---- 4. re-home survivors to their final ordinal, updating body/speaker/
  --         updated_at only where something actually changed.
  for i in 1..coalesce(array_length(kept_ids, 1), 0) loop
    update public.paragraphs
    set ordinal = kept_ordinals[i],
        body = kept_bodies[i],
        speaker = kept_speakers[i],
        updated_at = case when body <> kept_bodies[i] or speaker is distinct from kept_speakers[i] then now() else updated_at end
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

revoke all on function public.save_chat_chapter_draft(uuid, text, jsonb, boolean) from public;
grant execute on function public.save_chat_chapter_draft(uuid, text, jsonb, boolean) to authenticated;
