-- Chat/Text-AU format verification: save_chat_chapter_draft's speaker-aware
-- diff, and the format guards on both save_chapter_draft and
-- save_chat_chapter_draft.
--
-- Run with: node scripts/db-query.mjs supabase/tests/chat_format_test.sql
-- Follows the same structure as publish_pipeline_test.sql: fixtures in a
-- transaction rolled back at the end, `do $$ ... raise exception ... $$`
-- assertion blocks, acting as a real author via `set local role` +
-- `request.jwt.claims`.

set role postgres;
set search_path = public, extensions;

begin;

do $$
declare
  v_author uuid := '00000000-0000-0000-0000-0000000000d2';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', v_author, 'authenticated', 'authenticated',
    'author.chat-format-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Chat Format Test Author"}'
  )
  on conflict (id) do nothing;
end $$;

do $$
declare
  v_author uuid := '00000000-0000-0000-0000-0000000000d2';
  v_chat_story uuid;
  v_chat_chapter uuid;
  v_prose_story uuid;
  v_prose_chapter uuid;
begin
  insert into public.stories (id, slug, author_id, title, is_published, format, chat_participants)
  values (
    gen_random_uuid(), 'chat-format-test-story', v_author, 'Chat Format Test Story', false,
    'chat', '{"a": {"name": "Alex", "color": "#6366f1"}, "b": {"name": "Bea", "color": "#ec4899"}}'::jsonb
  )
  returning id into v_chat_story;

  insert into public.chapters (id, story_id, title, state)
  values (gen_random_uuid(), v_chat_story, 'Chat Chapter One', 'draft')
  returning id into v_chat_chapter;

  insert into public.stories (id, slug, author_id, title, is_published, format)
  values (gen_random_uuid(), 'chat-format-test-prose-story', v_author, 'Prose Control Story', false, 'prose')
  returning id into v_prose_story;

  insert into public.chapters (id, story_id, title, state)
  values (gen_random_uuid(), v_prose_story, 'Prose Chapter One', 'draft')
  returning id into v_prose_chapter;

  create temporary table chat_test_ids (key text primary key, value uuid);
  insert into chat_test_ids values
    ('author', v_author),
    ('chat_story', v_chat_story),
    ('chat_chapter', v_chat_chapter),
    ('prose_story', v_prose_story),
    ('prose_chapter', v_prose_chapter);
  grant select on chat_test_ids to authenticated;
end $$;

-- Act as the author for every RPC call below.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select value from chat_test_ids where key = 'author')::text)::text,
  true
);

-- ---------------------------------------------------------------------------
-- 1. Initial save: three messages, a/b/a.
-- ---------------------------------------------------------------------------

select public.save_chat_chapter_draft(
  (select value from chat_test_ids where key = 'chat_chapter'),
  'Chat Chapter One',
  '[
    {"speaker": "a", "text": "hey are you up"},
    {"speaker": "b", "text": "yeah whats going on"},
    {"speaker": "a", "text": "cant sleep, you?"}
  ]'::jsonb,
  false
);

do $$
declare
  v_chapter uuid := (select value from chat_test_ids where key = 'chat_chapter');
  v_1 uuid; v_2 uuid; v_3 uuid;
  v_count int;
  v_speakers text[];
begin
  select count(*) into v_count from public.paragraphs where chapter_id = v_chapter and deleted_at is null;
  if v_count <> 3 then
    raise exception 'FAIL: expected 3 paragraphs after initial save, got %', v_count;
  end if;

  select array_agg(speaker order by ordinal) into v_speakers
  from public.paragraphs where chapter_id = v_chapter and deleted_at is null;

  if v_speakers <> array['a', 'b', 'a'] then
    raise exception 'FAIL: expected speakers [a,b,a] in order, got %', v_speakers;
  end if;

  select id into v_1 from public.paragraphs where chapter_id = v_chapter and body = 'hey are you up' and deleted_at is null;
  select id into v_2 from public.paragraphs where chapter_id = v_chapter and body = 'yeah whats going on' and deleted_at is null;
  select id into v_3 from public.paragraphs where chapter_id = v_chapter and body = 'cant sleep, you?' and deleted_at is null;

  if v_1 is null or v_2 is null or v_3 is null then
    raise exception 'FAIL: could not find seeded chat messages 1/2/3';
  end if;

  create temporary table chat_test_msgs (key text primary key, value uuid);
  insert into chat_test_msgs values ('1', v_1), ('2', v_2), ('3', v_3);
end $$;

-- Anchor a comment to message 2, as the author (comment insert policy
-- requires the chapter to be published, so publish first).
select public.publish_chapter((select value from chat_test_ids where key = 'chat_chapter'));

do $$
declare
  v_chapter uuid := (select value from chat_test_ids where key = 'chat_chapter');
  v_author uuid := (select value from chat_test_ids where key = 'author');
  v_2 uuid := (select value from chat_test_msgs where key = '2');
  v_comment_2 uuid;
begin
  insert into public.comments (author_id, chapter_id, paragraph_id, body, body_snapshot)
  values (v_author, v_chapter, v_2, 'A comment anchored to message 2', 'yeah whats going on')
  returning id into v_comment_2;

  create temporary table chat_test_comments (key text primary key, value uuid);
  insert into chat_test_comments values ('on_2', v_comment_2);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Fix a typo in message 2's text, same speaker. Its id/comment anchor
--    must survive.
-- ---------------------------------------------------------------------------

select public.save_chat_chapter_draft(
  (select value from chat_test_ids where key = 'chat_chapter'),
  'Chat Chapter One',
  '[
    {"speaker": "a", "text": "hey are you up"},
    {"speaker": "b", "text": "yeah whats going on, tho"},
    {"speaker": "a", "text": "cant sleep, you?"}
  ]'::jsonb,
  false
);

do $$
declare
  v_2 uuid := (select value from chat_test_msgs where key = '2');
  v_body text;
  v_speaker text;
begin
  select body, speaker into v_body, v_speaker from public.paragraphs where id = v_2 and deleted_at is null;

  if v_body is null then
    raise exception 'FAIL: message 2 id was not preserved across a typo fix (it was soft-deleted or missing)';
  end if;

  if v_body <> 'yeah whats going on, tho' then
    raise exception 'FAIL: message 2 body was not updated to the fixed text (got: %)', v_body;
  end if;

  if v_speaker <> 'b' then
    raise exception 'FAIL: message 2 speaker changed unexpectedly during a text-only edit (got: %)', v_speaker;
  end if;

  if not exists (
    select 1 from public.comments
    where id = (select value from chat_test_comments where key = 'on_2')
      and paragraph_id = v_2
  ) then
    raise exception 'FAIL: comment anchored to message 2 was detached by a typo fix';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Move message 2 to the OTHER speaker, same text. Must produce a NEW
--    paragraph id for that slot (old one soft-deleted), never a silent
--    speaker reassignment on the same row.
-- ---------------------------------------------------------------------------

select public.save_chat_chapter_draft(
  (select value from chat_test_ids where key = 'chat_chapter'),
  'Chat Chapter One',
  '[
    {"speaker": "a", "text": "hey are you up"},
    {"speaker": "a", "text": "yeah whats going on, tho"},
    {"speaker": "a", "text": "cant sleep, you?"}
  ]'::jsonb,
  false
);

do $$
declare
  v_2 uuid := (select value from chat_test_msgs where key = '2');
  v_still_live boolean;
begin
  select exists (
    select 1 from public.paragraphs where id = v_2 and deleted_at is null
  ) into v_still_live;

  if v_still_live then
    raise exception 'FAIL: message 2''s old paragraph row should have been soft-deleted after a speaker change, not silently reassigned';
  end if;

  if not exists (select 1 from public.paragraphs where id = v_2 and deleted_at is not null) then
    raise exception 'FAIL: message 2''s old paragraph row is gone entirely, not soft-deleted (comment anchors would 404)';
  end if;

  if not exists (
    select 1 from public.paragraphs
    where chapter_id = (select value from chat_test_ids where key = 'chat_chapter')
      and deleted_at is null
      and body = 'yeah whats going on, tho'
      and speaker = 'a'
  ) then
    raise exception 'FAIL: a new paragraph with the moved text under speaker a was not inserted';
  end if;

  -- The old comment must still resolve to the soft-deleted paragraph (its
  -- body_snapshot keeps it legible), not to the new speaker-a row.
  if not exists (
    select 1 from public.comments
    where id = (select value from chat_test_comments where key = 'on_2')
      and paragraph_id = v_2
  ) then
    raise exception 'FAIL: comment anchor changed away from the original (now soft-deleted) message 2 row';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Format guards: save_chat_chapter_draft against a prose story's chapter,
--    and save_chapter_draft against a chat story's chapter, both raise.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.save_chat_chapter_draft(
      (select value from chat_test_ids where key = 'prose_chapter'),
      'Should Not Save',
      '[{"speaker": "a", "text": "nope"}]'::jsonb,
      false
    );
    raise exception 'FAIL: save_chat_chapter_draft was allowed against a prose-format story';
  exception
    when others then
      if sqlerrm not like '%does not belong to a chat-format story%' then
        raise;
      end if;
  end;
end $$;

do $$
begin
  begin
    perform public.save_chapter_draft(
      (select value from chat_test_ids where key = 'chat_chapter'),
      'Should Not Save',
      'Some plain prose text.',
      false
    );
    raise exception 'FAIL: save_chapter_draft was allowed against a chat-format story';
  exception
    when others then
      if sqlerrm not like '%belongs to a chat-format story%' then
        raise;
      end if;
  end;
end $$;

reset role;
reset request.jwt.claims;

do $$
begin
  raise notice 'ALL CHAT FORMAT ASSERTIONS PASSED';
end $$;

rollback;
