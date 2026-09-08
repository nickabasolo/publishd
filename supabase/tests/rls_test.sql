-- RLS verification suite for Phase 0.
--
-- Run with:
--   psql "$(supabase db url)" -f supabase/tests/rls_test.sql
--   (or via the Supabase Studio SQL editor / any psql connection with
--   sufficient privileges to insert into auth.users)
--
-- Requires the migrations in supabase/migrations/ to already be applied.
-- The whole file runs inside one transaction that is rolled back at the end
-- (see COMMIT NOTE at the bottom) so it never leaves fixture data behind.
--
-- Each assertion is a `do $$ ... raise exception ... $$` block: silence means
-- pass, an exception means a real RLS regression. This is plain SQL, not
-- pgTAP, per the Phase 0 spec.
--
-- Mechanics: Postgres RLS is bypassed for the table owner / superuser, so
-- every assertion must `set local role` to a non-privileged role and set the
-- `request.jwt.claims` GUC that Supabase's `auth.uid()` reads from. `reset
-- role` (or the transaction's implicit rollback) returns to postgres between
-- steps.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures — two authors, one plain reader, one story each, chapters, a
-- notification, and reading progress. Inserted as postgres (bypasses RLS).
-- Inserting into auth.users fires handle_new_user, which creates the
-- matching public.profiles row for us.
-- ---------------------------------------------------------------------------

do $$
declare
  v_author_a uuid := '00000000-0000-0000-0000-0000000000a1';
  v_author_b uuid := '00000000-0000-0000-0000-0000000000b1';
  v_reader   uuid := '00000000-0000-0000-0000-0000000000c1';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values
    ('00000000-0000-0000-0000-000000000000', v_author_a, 'authenticated', 'authenticated',
     'author.a.rls-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Test Author A"}'),
    ('00000000-0000-0000-0000-000000000000', v_author_b, 'authenticated', 'authenticated',
     'author.b.rls-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Test Author B"}'),
    ('00000000-0000-0000-0000-000000000000', v_reader, 'authenticated', 'authenticated',
     'reader.rls-test@example.com', crypt('password', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Test Reader"}')
  on conflict (id) do nothing;
end $$;

do $$
declare
  v_author_a uuid := '00000000-0000-0000-0000-0000000000a1';
  v_author_b uuid := '00000000-0000-0000-0000-0000000000b1';
  v_reader   uuid := '00000000-0000-0000-0000-0000000000c1';
  v_story_published uuid;
  v_story_draft uuid;
  v_chapter_visible uuid;
  v_chapter_hidden uuid;
  v_chapter_b uuid;
begin
  insert into public.stories (id, slug, author_id, title, is_published)
  values (gen_random_uuid(), 'rls-test-published-story', v_author_a, 'RLS Test Published Story', true)
  returning id into v_story_published;

  insert into public.stories (id, slug, author_id, title, is_published)
  values (gen_random_uuid(), 'rls-test-draft-story', v_author_a, 'RLS Test Draft Story', false)
  returning id into v_story_draft;

  insert into public.chapters (id, story_id, number, title, state, hidden)
  values (gen_random_uuid(), v_story_published, 1, 'Visible Chapter', 'published', false)
  returning id into v_chapter_visible;

  insert into public.chapters (id, story_id, number, title, state, hidden)
  values (gen_random_uuid(), v_story_published, 2, 'Retracted Chapter', 'published', true)
  returning id into v_chapter_hidden;

  insert into public.chapters (id, story_id, number, title, state, hidden)
  values (gen_random_uuid(), (
    select id from public.stories where slug = 'rls-test-published-story'
  ), null, 'Author B has no chapters here yet', 'draft', false);

  -- A chapter owned by author B, used for the "A cannot update B's chapter" check.
  insert into public.stories (id, slug, author_id, title, is_published)
  values (gen_random_uuid(), 'rls-test-story-b', v_author_b, 'RLS Test Story B', true);

  insert into public.chapters (id, story_id, number, title, state, hidden)
  values (
    gen_random_uuid(),
    (select id from public.stories where slug = 'rls-test-story-b'),
    1, 'Author B Chapter', 'published', false
  )
  returning id into v_chapter_b;

  insert into public.reading_progress (profile_id, story_id, completed)
  values (v_reader, v_story_published, false);

  -- Stash ids in a temp table so later blocks in this session can find them
  -- without re-deriving from slugs every time.
  create temporary table rls_test_ids (key text primary key, value uuid);
  insert into rls_test_ids values
    ('author_a', v_author_a),
    ('author_b', v_author_b),
    ('reader', v_reader),
    ('story_published', v_story_published),
    ('story_draft', v_story_draft),
    ('chapter_visible', v_chapter_visible),
    ('chapter_hidden', v_chapter_hidden),
    ('chapter_b', v_chapter_b);

  -- The assertions below `set local role` to anon/authenticated to exercise
  -- RLS honestly. Table-privilege checks apply to the *current* role too
  -- (not just RLS), and a temp table created as postgres grants nothing to
  -- PUBLIC by default — so without this grant every later lookup against
  -- rls_test_ids would fail with "permission denied for table
  -- rls_test_ids" regardless of whether the RLS policies under test are
  -- correct. This is scratch fixture data for the duration of one
  -- transaction that gets rolled back, so a blanket grant is harmless.
  grant select on rls_test_ids to anon, authenticated;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Anon can select published stories but NOT drafts.
-- ---------------------------------------------------------------------------

set local role anon;
reset request.jwt.claims;

do $$
declare
  v_published_visible boolean;
  v_draft_visible boolean;
begin
  select exists (
    select 1 from public.stories
    where id = (select value from rls_test_ids where key = 'story_published')
  ) into v_published_visible;

  select exists (
    select 1 from public.stories
    where id = (select value from rls_test_ids where key = 'story_draft')
  ) into v_draft_visible;

  if not v_published_visible then
    raise exception 'FAIL: anon could not see a published story';
  end if;

  if v_draft_visible then
    raise exception 'FAIL: anon could see an unpublished draft story';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 2. Anon cannot see a hidden published chapter.
-- ---------------------------------------------------------------------------

set local role anon;
reset request.jwt.claims;

do $$
declare
  v_hidden_visible boolean;
  v_visible_visible boolean;
begin
  select exists (
    select 1 from public.chapters
    where id = (select value from rls_test_ids where key = 'chapter_hidden')
  ) into v_hidden_visible;

  select exists (
    select 1 from public.chapters
    where id = (select value from rls_test_ids where key = 'chapter_visible')
  ) into v_visible_visible;

  if v_hidden_visible then
    raise exception 'FAIL: anon could see a hidden published chapter';
  end if;

  if not v_visible_visible then
    raise exception 'FAIL: anon could not see a normal published chapter';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 3. Author A cannot update author B's chapter.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select value from rls_test_ids where key = 'author_a')::text)::text,
  true
);

do $$
declare
  v_updated_rows int;
begin
  update public.chapters
  set title = 'HIJACKED BY AUTHOR A'
  where id = (select value from rls_test_ids where key = 'chapter_b');

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> 0 then
    raise exception 'FAIL: author A updated author B''s chapter (% rows)', v_updated_rows;
  end if;
end $$;

reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 4. Anon cannot insert into notifications.
-- ---------------------------------------------------------------------------

set local role anon;
reset request.jwt.claims;

do $$
begin
  begin
    insert into public.notifications (profile_id, type)
    values ((select value from rls_test_ids where key = 'reader'), 'story_followed');

    -- If we get here, the insert was not blocked at all.
    raise exception 'FAIL: anon inserted a notification directly';
  exception
    when insufficient_privilege then
      -- Expected: no insert policy exists for notifications.
      null;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 5. A reader cannot select another reader's reading_progress.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select value from rls_test_ids where key = 'author_a')::text)::text,
  true
);

do $$
declare
  v_visible boolean;
begin
  select exists (
    select 1 from public.reading_progress
    where profile_id = (select value from rls_test_ids where key = 'reader')
  ) into v_visible;

  if v_visible then
    raise exception 'FAIL: author A could see reader''s reading_progress row';
  end if;
end $$;

reset role;
reset request.jwt.claims;

do $$
begin
  raise notice 'ALL RLS ASSERTIONS PASSED';
end $$;

-- COMMIT NOTE: roll back so this suite never leaves fixture rows behind and
-- can be re-run at will. Change to COMMIT only if you deliberately want to
-- keep the fixture data around for manual poking in Studio.
rollback;
