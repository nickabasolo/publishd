-- Phase 4 verification: the paragraph diff and the publish state machine.
--
-- Run with: node scripts/db-query.mjs supabase/tests/publish_pipeline_test.sql
-- (as a role that can `set role postgres`, since fixtures need to insert
-- into auth.users). Runs inside one transaction, rolled back at the end.
--
-- Unlike rls_test.sql this exercises the RPCs directly as their SQL
-- definer/invoker semantics dictate, using `set local role` +
-- `request.jwt.claims` to act as a real author, exactly like the RLS suite.

set role postgres;
set search_path = public, extensions;

begin;

do $$
declare
  v_author uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', v_author, 'authenticated', 'authenticated',
    'author.pipeline-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Pipeline Test Author"}'
  )
  on conflict (id) do nothing;
end $$;

do $$
declare
  v_author uuid := '00000000-0000-0000-0000-0000000000d1';
  v_story uuid;
  v_chapter uuid;
begin
  insert into public.stories (id, slug, author_id, title, is_published)
  values (gen_random_uuid(), 'pipeline-test-story', v_author, 'Pipeline Test Story', false)
  returning id into v_story;

  insert into public.chapters (id, story_id, title, state)
  values (gen_random_uuid(), v_story, 'Chapter One', 'draft')
  returning id into v_chapter;

  create temporary table pipeline_test_ids (key text primary key, value uuid);
  insert into pipeline_test_ids values ('author', v_author), ('story', v_story), ('chapter', v_chapter);
  grant select on pipeline_test_ids to authenticated;
end $$;

-- Act as the author for every RPC call below.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select value from pipeline_test_ids where key = 'author')::text)::text,
  true
);

-- ---------------------------------------------------------------------------
-- 1. Initial save: three paragraphs, A / B / C.
-- ---------------------------------------------------------------------------

select public.save_chapter_draft(
  (select value from pipeline_test_ids where key = 'chapter'),
  'Chapter One',
  E'Paragraph A, the first one.\n\nParagraph B, the second one.\n\nParagraph C, the third one.',
  false
);

do $$
declare
  v_chapter uuid := (select value from pipeline_test_ids where key = 'chapter');
  v_a uuid; v_b uuid; v_c uuid;
  v_count int;
begin
  select count(*) into v_count from public.paragraphs where chapter_id = v_chapter and deleted_at is null;
  if v_count <> 3 then
    raise exception 'FAIL: expected 3 paragraphs after initial save, got %', v_count;
  end if;

  select id into v_a from public.paragraphs where chapter_id = v_chapter and body = 'Paragraph A, the first one.' and deleted_at is null;
  select id into v_b from public.paragraphs where chapter_id = v_chapter and body = 'Paragraph B, the second one.' and deleted_at is null;
  select id into v_c from public.paragraphs where chapter_id = v_chapter and body = 'Paragraph C, the third one.' and deleted_at is null;

  if v_a is null or v_b is null or v_c is null then
    raise exception 'FAIL: could not find seeded paragraphs A/B/C';
  end if;

  create temporary table pipeline_test_paras (key text primary key, value uuid);
  insert into pipeline_test_paras values ('a', v_a), ('b', v_b), ('c', v_c);
end $$;

-- Anchor a comment to paragraph B, as the author (comment insert policy
-- requires the chapter to be published, so publish first).
select public.publish_chapter((select value from pipeline_test_ids where key = 'chapter'));

do $$
declare
  v_chapter uuid := (select value from pipeline_test_ids where key = 'chapter');
  v_author uuid := (select value from pipeline_test_ids where key = 'author');
  v_b uuid := (select value from pipeline_test_paras where key = 'b');
  v_comment_b uuid;
begin
  insert into public.comments (author_id, chapter_id, paragraph_id, body, body_snapshot)
  values (v_author, v_chapter, v_b, 'A comment anchored to paragraph B', 'Paragraph B, the second one.')
  returning id into v_comment_b;

  create temporary table pipeline_test_comments (key text primary key, value uuid);
  insert into pipeline_test_comments values ('on_b', v_comment_b);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Insert a paragraph in the middle (A, X, B, C). A/B/C must keep their
--    ids; the comment on B must stay anchored to the same paragraph id.
-- ---------------------------------------------------------------------------

select public.save_chapter_draft(
  (select value from pipeline_test_ids where key = 'chapter'),
  'Chapter One',
  E'Paragraph A, the first one.\n\nA brand new paragraph X.\n\nParagraph B, the second one.\n\nParagraph C, the third one.',
  false
);

do $$
declare
  v_chapter uuid := (select value from pipeline_test_ids where key = 'chapter');
  v_a uuid := (select value from pipeline_test_paras where key = 'a');
  v_b uuid := (select value from pipeline_test_paras where key = 'b');
  v_c uuid := (select value from pipeline_test_paras where key = 'c');
  v_count int;
begin
  select count(*) into v_count from public.paragraphs where chapter_id = v_chapter and deleted_at is null;
  if v_count <> 4 then
    raise exception 'FAIL: expected 4 paragraphs after insert, got %', v_count;
  end if;

  if not exists (select 1 from public.paragraphs where id = v_a and deleted_at is null and body = 'Paragraph A, the first one.') then
    raise exception 'FAIL: paragraph A id was not preserved after inserting a new paragraph';
  end if;
  if not exists (select 1 from public.paragraphs where id = v_b and deleted_at is null and body = 'Paragraph B, the second one.') then
    raise exception 'FAIL: paragraph B id was not preserved after inserting a new paragraph';
  end if;
  if not exists (select 1 from public.paragraphs where id = v_c and deleted_at is null and body = 'Paragraph C, the third one.') then
    raise exception 'FAIL: paragraph C id was not preserved after inserting a new paragraph';
  end if;

  -- The comment anchored to B must still resolve to a live paragraph with
  -- the same id (i.e. it never got reattached / detached).
  if not exists (
    select 1 from public.comments
    where id = (select value from pipeline_test_comments where key = 'on_b')
      and paragraph_id = v_b
  ) then
    raise exception 'FAIL: comment anchored to paragraph B was detached by an unrelated insert';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Fix a typo in B (small edit, similarity should clear 0.6). B's id must
--    be preserved and its body updated; the comment stays anchored.
-- ---------------------------------------------------------------------------

select public.save_chapter_draft(
  (select value from pipeline_test_ids where key = 'chapter'),
  'Chapter One',
  E'Paragraph A, the first one.\n\nA brand new paragraph X.\n\nParagraph B, the second one, fixed.\n\nParagraph C, the third one.',
  false
);

do $$
declare
  v_b uuid := (select value from pipeline_test_paras where key = 'b');
  v_body text;
begin
  select body into v_body from public.paragraphs where id = v_b and deleted_at is null;

  if v_body is null then
    raise exception 'FAIL: paragraph B id was not preserved across a typo fix (it was soft-deleted or missing)';
  end if;

  if v_body <> 'Paragraph B, the second one, fixed.' then
    raise exception 'FAIL: paragraph B body was not updated to the fixed text (got: %)', v_body;
  end if;

  if not exists (
    select 1 from public.comments
    where id = (select value from pipeline_test_comments where key = 'on_b')
      and paragraph_id = v_b
  ) then
    raise exception 'FAIL: comment anchored to paragraph B was detached by a typo fix';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Wholesale rewrite of B: below the 0.6 similarity threshold. The old B
--    must be soft-deleted (comment survives via body_snapshot, but its
--    paragraph_id no longer resolves to a live paragraph); a new paragraph
--    is inserted instead.
-- ---------------------------------------------------------------------------

select public.save_chapter_draft(
  (select value from pipeline_test_ids where key = 'chapter'),
  'Chapter One',
  E'Paragraph A, the first one.\n\nA brand new paragraph X.\n\nSomething entirely different about dragons and moonlight.\n\nParagraph C, the third one.',
  false
);

do $$
declare
  v_b uuid := (select value from pipeline_test_paras where key = 'b');
  v_still_live boolean;
  v_comment_body_snapshot text;
begin
  select exists (
    select 1 from public.paragraphs where id = v_b and deleted_at is null
  ) into v_still_live;

  if v_still_live then
    raise exception 'FAIL: paragraph B should have been soft-deleted after a wholesale rewrite (similarity below 0.6)';
  end if;

  if not exists (select 1 from public.paragraphs where id = v_b and deleted_at is not null) then
    raise exception 'FAIL: paragraph B row is gone entirely, not soft-deleted (comment anchors would 404)';
  end if;

  if not exists (
    select 1 from public.paragraphs
    where chapter_id = (select value from pipeline_test_ids where key = 'chapter')
      and deleted_at is null
      and body = 'Something entirely different about dragons and moonlight.'
  ) then
    raise exception 'FAIL: the rewritten paragraph was not inserted as a new row';
  end if;

  select body_snapshot into v_comment_body_snapshot
  from public.comments where id = (select value from pipeline_test_comments where key = 'on_b');

  if v_comment_body_snapshot is null then
    raise exception 'FAIL: comment lost its body_snapshot; it can no longer show quoted context after detachment';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Publish assigns number = 1; a second chapter published after it gets 2;
--    publishing again does not reset published_at; stories.updated_at bumps.
-- ---------------------------------------------------------------------------

do $$
declare
  v_chapter uuid := (select value from pipeline_test_ids where key = 'chapter');
  v_number int;
  v_published_at timestamptz;
  v_published_at_2 timestamptz;
begin
  select number, published_at into v_number, v_published_at from public.chapters where id = v_chapter;

  if v_number <> 1 then
    raise exception 'FAIL: expected chapter number 1 after first publish, got %', v_number;
  end if;
  if v_published_at is null then
    raise exception 'FAIL: published_at was not set on publish';
  end if;

  -- Re-publish (simulating a subsequent edit + republish) must not reset published_at.
  perform pg_sleep(0.01);
  perform public.publish_chapter(v_chapter);

  select published_at into v_published_at_2 from public.chapters where id = v_chapter;
  if v_published_at_2 <> v_published_at then
    raise exception 'FAIL: republishing reset published_at (% -> %)', v_published_at, v_published_at_2;
  end if;
end $$;

do $$
declare
  v_story uuid := (select value from pipeline_test_ids where key = 'story');
  v_author uuid := (select value from pipeline_test_ids where key = 'author');
  v_chapter2 uuid;
  v_number2 int;
begin
  insert into public.chapters (id, story_id, title, state)
  values (gen_random_uuid(), v_story, 'Chapter Two', 'draft')
  returning id into v_chapter2;

  perform public.publish_chapter(v_chapter2);

  select number into v_number2 from public.chapters where id = v_chapter2;
  if v_number2 <> 2 then
    raise exception 'FAIL: second published chapter expected number 2, got %', v_number2;
  end if;

  -- Only the most recent (chapter 2) may be unpublished; chapter 1 must not.
  begin
    perform public.unpublish_chapter((select value from pipeline_test_ids where key = 'chapter'));
    raise exception 'FAIL: unpublish_chapter allowed unpublishing a non-latest chapter';
  exception
    when others then
      if sqlerrm not like '%most recently published%' then
        raise;
      end if;
  end;

  perform public.unpublish_chapter(v_chapter2);
  if exists (select 1 from public.chapters where id = v_chapter2 and (state <> 'draft' or number is not null)) then
    raise exception 'FAIL: unpublish_chapter did not revert chapter 2 to a numberless draft';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Comment paragraph/chapter mismatch is rejected.
-- ---------------------------------------------------------------------------

do $$
declare
  v_author uuid := (select value from pipeline_test_ids where key = 'author');
  v_chapter uuid := (select value from pipeline_test_ids where key = 'chapter');
  v_other_story uuid;
  v_other_chapter uuid;
  v_other_paragraph uuid;
begin
  insert into public.stories (id, slug, author_id, title, is_published)
  values (gen_random_uuid(), 'pipeline-test-other-story', v_author, 'Other Story', false)
  returning id into v_other_story;

  insert into public.chapters (id, story_id, title, state)
  values (gen_random_uuid(), v_other_story, 'Other Chapter', 'draft')
  returning id into v_other_chapter;

  insert into public.paragraphs (chapter_id, ordinal, body)
  values (v_other_chapter, 0, 'A paragraph in a completely different chapter.')
  returning id into v_other_paragraph;

  begin
    insert into public.comments (author_id, chapter_id, paragraph_id, body)
    values (v_author, v_chapter, v_other_paragraph, 'Mismatched anchor');
    raise exception 'FAIL: comment with a cross-chapter paragraph_id was accepted';
  exception
    when others then
      if sqlerrm not like '%does not belong to chapter%' then
        raise;
      end if;
  end;
end $$;

reset role;
reset request.jwt.claims;

do $$
begin
  raise notice 'ALL PUBLISH PIPELINE ASSERTIONS PASSED';
end $$;

rollback;
