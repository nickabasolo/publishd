-- Phase 5 verification: notification triggers.
--
-- Run with:
--   node scripts/db-query.mjs supabase/tests/notification_triggers_test.sql
--   (needs `set role postgres` first, since fixtures insert into auth.users
--   and read pgcrypto's gen_salt/crypt from the `extensions` schema — same
--   as rls_test.sql / publish_pipeline_test.sql.)
--
-- Asserts, for each trigger, that one event produces exactly one
-- notification per intended recipient, no duplicates, and no
-- self-notifications:
--   1. chapter published -> one notification per story_follows row,
--      never to the author.
--   2. top-level comment -> one notification to the story's author.
--   3. reply comment -> one notification to the parent comment's author,
--      NOT to the story's author (unless they're the same profile via
--      a separate path — not exercised here since author != commenter).
--   4. a comment authored by the story's own author -> no self-notification.
--   5. story_follows insert -> one notification to the story's author.
--   6. author_follows insert -> one notification to the followed author.
--
-- Runs inside one transaction, rolled back at the end.

set role postgres;
set search_path = public, extensions;

begin;

do $$
declare
  v_author  uuid := '00000000-0000-0000-0000-0000000000e1';
  v_reader1 uuid := '00000000-0000-0000-0000-0000000000e2';
  v_reader2 uuid := '00000000-0000-0000-0000-0000000000e3';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values
    ('00000000-0000-0000-0000-000000000000', v_author, 'authenticated', 'authenticated',
     'author.notif-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Notif Test Author"}'),
    ('00000000-0000-0000-0000-000000000000', v_reader1, 'authenticated', 'authenticated',
     'reader1.notif-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Notif Test Reader One"}'),
    ('00000000-0000-0000-0000-000000000000', v_reader2, 'authenticated', 'authenticated',
     'reader2.notif-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Notif Test Reader Two"}')
  on conflict (id) do nothing;
end $$;

do $$
declare
  v_author  uuid := '00000000-0000-0000-0000-0000000000e1';
  v_reader1 uuid := '00000000-0000-0000-0000-0000000000e2';
  v_reader2 uuid := '00000000-0000-0000-0000-0000000000e3';
  v_story uuid;
  v_chapter uuid;
begin
  insert into public.stories (id, slug, author_id, title, is_published)
  values (gen_random_uuid(), 'notif-test-story', v_author, 'Notif Test Story', false)
  returning id into v_story;

  insert into public.chapters (id, story_id, title, state)
  values (gen_random_uuid(), v_story, 'Chapter One', 'draft')
  returning id into v_chapter;

  create temporary table notif_test_ids (key text primary key, value uuid);
  insert into notif_test_ids values
    ('author', v_author), ('reader1', v_reader1), ('reader2', v_reader2),
    ('story', v_story), ('chapter', v_chapter);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Both readers follow the story (before publish) -> each follow insert
--    itself should notify the author exactly once (story_followed).
-- ---------------------------------------------------------------------------

insert into public.story_follows (profile_id, target_id)
select value, (select value from notif_test_ids where key = 'story')
from notif_test_ids where key in ('reader1', 'reader2');

do $$
declare
  v_author uuid := (select value from notif_test_ids where key = 'author');
  v_story uuid := (select value from notif_test_ids where key = 'story');
  v_count int;
begin
  select count(*) into v_count
  from public.notifications
  where profile_id = v_author and type = 'story_followed' and story_id = v_story;
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 story_followed notifications to the author, got %', v_count;
  end if;

  -- No self-notification: the author following their own story (if it were
  -- possible) must not notify themselves. Exercise it directly.
  insert into public.story_follows (profile_id, target_id) values (v_author, v_story);
  select count(*) into v_count
  from public.notifications
  where profile_id = v_author and type = 'story_followed' and story_id = v_story;
  if v_count <> 2 then
    raise exception 'FAIL: author following their own story produced a self-notification';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. author_follows: follower notifies the followed author exactly once.
-- ---------------------------------------------------------------------------

insert into public.author_follows (follower_id, author_id)
values (
  (select value from notif_test_ids where key = 'reader1'),
  (select value from notif_test_ids where key = 'author')
);

do $$
declare
  v_author uuid := (select value from notif_test_ids where key = 'author');
  v_reader1 uuid := (select value from notif_test_ids where key = 'reader1');
  v_count int;
begin
  select count(*) into v_count
  from public.notifications
  where profile_id = v_author and type = 'author_followed' and actor_id = v_reader1;
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 author_followed notification, got %', v_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Publish the chapter -> chapter_published fans out to story_follows
--    (reader1, reader2), never to the author, exactly once each.
-- ---------------------------------------------------------------------------

do $$
begin
  perform public._do_publish((select value from notif_test_ids where key = 'chapter'));
end $$;

do $$
declare
  v_author uuid := (select value from notif_test_ids where key = 'author');
  v_reader1 uuid := (select value from notif_test_ids where key = 'reader1');
  v_reader2 uuid := (select value from notif_test_ids where key = 'reader2');
  v_story uuid := (select value from notif_test_ids where key = 'story');
  v_count int;
  v_self int;
begin
  select count(*) into v_count
  from public.notifications
  where type = 'chapter_published' and story_id = v_story
    and profile_id in (v_reader1, v_reader2);
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 chapter_published notifications (one per follower), got %', v_count;
  end if;

  select count(*) into v_self
  from public.notifications
  where type = 'chapter_published' and story_id = v_story and profile_id = v_author;
  if v_self <> 0 then
    raise exception 'FAIL: author was notified of their own chapter publish';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Top-level comment by reader1 -> notifies the story's author exactly
--    once (comment_on_story).
-- ---------------------------------------------------------------------------

do $$
declare
  v_reader1 uuid := (select value from notif_test_ids where key = 'reader1');
  v_chapter uuid := (select value from notif_test_ids where key = 'chapter');
  v_top_comment uuid;
begin
  insert into public.comments (author_id, chapter_id, body)
  values (v_reader1, v_chapter, 'A top-level comment.')
  returning id into v_top_comment;

  insert into notif_test_ids values ('top_comment', v_top_comment);
end $$;

do $$
declare
  v_author uuid := (select value from notif_test_ids where key = 'author');
  v_top_comment uuid := (select value from notif_test_ids where key = 'top_comment');
  v_count int;
begin
  select count(*) into v_count
  from public.notifications
  where profile_id = v_author and type = 'comment_on_story' and comment_id = v_top_comment;
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 comment_on_story notification, got %', v_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Reply by reader2 to reader1's top-level comment -> notifies reader1
--    (the parent comment's author) exactly once, and does NOT also notify
--    the story's author a second time via the reply.
-- ---------------------------------------------------------------------------

do $$
declare
  v_reader2 uuid := (select value from notif_test_ids where key = 'reader2');
  v_chapter uuid := (select value from notif_test_ids where key = 'chapter');
  v_top_comment uuid := (select value from notif_test_ids where key = 'top_comment');
  v_reply uuid;
begin
  insert into public.comments (author_id, chapter_id, parent_id, body)
  values (v_reader2, v_chapter, v_top_comment, 'A reply.')
  returning id into v_reply;

  insert into notif_test_ids values ('reply_comment', v_reply);
end $$;

do $$
declare
  v_author uuid := (select value from notif_test_ids where key = 'author');
  v_reader1 uuid := (select value from notif_test_ids where key = 'reader1');
  v_reply uuid := (select value from notif_test_ids where key = 'reply_comment');
  v_reply_count int;
  v_author_count int;
begin
  select count(*) into v_reply_count
  from public.notifications
  where profile_id = v_reader1 and type = 'comment_reply' and comment_id = v_reply;
  if v_reply_count <> 1 then
    raise exception 'FAIL: expected exactly 1 comment_reply notification to the parent author, got %', v_reply_count;
  end if;

  select count(*) into v_author_count
  from public.notifications
  where profile_id = v_author and comment_id = v_reply;
  if v_author_count <> 0 then
    raise exception 'FAIL: story author should not be separately notified about a reply, got %', v_author_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. No self-notifications: the story's own author posting a top-level
--    comment on their own story must not notify themselves; a reply by the
--    parent comment's own author to their own comment must not notify
--    themselves either.
-- ---------------------------------------------------------------------------

do $$
declare
  v_author uuid := (select value from notif_test_ids where key = 'author');
  v_chapter uuid := (select value from notif_test_ids where key = 'chapter');
  v_self_comment uuid;
  v_self_reply uuid;
  v_count int;
begin
  insert into public.comments (author_id, chapter_id, body)
  values (v_author, v_chapter, 'Author commenting on their own story.')
  returning id into v_self_comment;

  select count(*) into v_count
  from public.notifications
  where profile_id = v_author and comment_id = v_self_comment;
  if v_count <> 0 then
    raise exception 'FAIL: author was notified of their own top-level comment';
  end if;

  insert into public.comments (author_id, chapter_id, parent_id, body)
  values (v_author, v_chapter, v_self_comment, 'Author replying to themselves.')
  returning id into v_self_reply;

  select count(*) into v_count
  from public.notifications
  where profile_id = v_author and comment_id = v_self_reply;
  if v_count <> 0 then
    raise exception 'FAIL: author was notified of their own reply to their own comment';
  end if;
end $$;

do $$
begin
  raise notice 'ALL NOTIFICATION TRIGGER ASSERTIONS PASSED';
end $$;

rollback;
