-- Row Level Security. This is the actual security boundary of the product —
-- the anon key is public by design and ships in the client bundle.

-- =============================================================================
-- stories
-- =============================================================================

alter table public.stories enable row level security;

create policy "published stories are public, drafts are author-only"
  on public.stories for select
  using (is_published or author_id = auth.uid());

create policy "authors create their own stories"
  on public.stories for insert
  with check (auth.uid() = author_id);

create policy "authors update their own stories"
  on public.stories for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "authors delete their own stories"
  on public.stories for delete
  using (author_id = auth.uid());

-- =============================================================================
-- tags / story_tags — public reference data, no client writes for MVP
-- (tags are created/attached only via server-side RPCs in a later phase).
-- =============================================================================

alter table public.tags enable row level security;

create policy "tags are publicly readable"
  on public.tags for select
  using (true);

alter table public.story_tags enable row level security;

create policy "story_tags are publicly readable"
  on public.story_tags for select
  using (true);

-- =============================================================================
-- chapters
-- =============================================================================

alter table public.chapters enable row level security;

create policy "published, unhidden chapters are public; authors see all their own"
  on public.chapters for select
  using (
    (state = 'published' and not hidden)
    or exists (
      select 1 from public.stories s
      where s.id = chapters.story_id and s.author_id = auth.uid()
    )
  );

create policy "authors create chapters on their own stories"
  on public.chapters for insert
  with check (
    exists (
      select 1 from public.stories s
      where s.id = chapters.story_id and s.author_id = auth.uid()
    )
  );

create policy "authors update chapters on their own stories"
  on public.chapters for update
  using (
    exists (
      select 1 from public.stories s
      where s.id = chapters.story_id and s.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stories s
      where s.id = chapters.story_id and s.author_id = auth.uid()
    )
  );

create policy "authors delete chapters on their own stories"
  on public.chapters for delete
  using (
    exists (
      select 1 from public.stories s
      where s.id = chapters.story_id and s.author_id = auth.uid()
    )
  );

-- =============================================================================
-- paragraphs
-- Client writes are not expected in normal operation (paragraphs are written
-- only through the save_chapter_draft RPC in Phase 4, which runs as the
-- calling user and is still subject to these policies), but the ownership
-- policies exist as the enforced boundary regardless of entry point.
-- =============================================================================

alter table public.paragraphs enable row level security;

create policy "paragraphs of visible chapters are readable"
  on public.paragraphs for select
  using (
    exists (
      select 1 from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = paragraphs.chapter_id
        and ((c.state = 'published' and not c.hidden) or s.author_id = auth.uid())
    )
  );

create policy "authors write paragraphs on their own stories (insert)"
  on public.paragraphs for insert
  with check (
    exists (
      select 1 from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = paragraphs.chapter_id and s.author_id = auth.uid()
    )
  );

create policy "authors write paragraphs on their own stories (update)"
  on public.paragraphs for update
  using (
    exists (
      select 1 from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = paragraphs.chapter_id and s.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = paragraphs.chapter_id and s.author_id = auth.uid()
    )
  );

create policy "authors write paragraphs on their own stories (delete)"
  on public.paragraphs for delete
  using (
    exists (
      select 1 from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = paragraphs.chapter_id and s.author_id = auth.uid()
    )
  );

-- =============================================================================
-- comments
-- =============================================================================

alter table public.comments enable row level security;

create policy "comments on visible chapters are readable"
  on public.comments for select
  using (
    exists (
      select 1 from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = comments.chapter_id
        and ((c.state = 'published' and not c.hidden) or s.author_id = auth.uid())
    )
  );

-- Beyond `auth.uid() = author_id`: also require the target chapter to
-- actually be visible (published, not hidden). Without this, a caller who
-- merely knows a chapter's uuid could plant a comment on someone else's
-- draft or a retracted chapter — invisible to everyone (the select policy
-- would still hide it) but silently persisted until/unless that chapter is
-- later published, at which point a stranger's comment appears with no
-- insert-time check having ever run against a public audience.
create policy "authenticated users post comments as themselves"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.chapters c
      where c.id = comments.chapter_id
        and c.state = 'published' and not c.hidden
    )
  );

-- Soft-delete only, by the comment's own author. (Editing comment bodies is
-- out of scope for MVP; this covers the delete-in-place pattern.)
create policy "authors soft-delete their own comments"
  on public.comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- =============================================================================
-- story_likes / paragraph_likes / story_follows / author_follows
-- Public select (counts and follow-state must be cross-visible); insert/delete
-- gated to the owning column matching the caller.
-- =============================================================================

alter table public.story_likes enable row level security;

create policy "story_likes are publicly readable"
  on public.story_likes for select
  using (true);

create policy "users like stories as themselves"
  on public.story_likes for insert
  with check (auth.uid() = profile_id);

create policy "users unlike stories as themselves"
  on public.story_likes for delete
  using (auth.uid() = profile_id);

alter table public.paragraph_likes enable row level security;

create policy "paragraph_likes are publicly readable"
  on public.paragraph_likes for select
  using (true);

create policy "users like paragraphs as themselves"
  on public.paragraph_likes for insert
  with check (auth.uid() = profile_id);

create policy "users unlike paragraphs as themselves"
  on public.paragraph_likes for delete
  using (auth.uid() = profile_id);

alter table public.story_follows enable row level security;

create policy "story_follows are publicly readable"
  on public.story_follows for select
  using (true);

create policy "users follow stories as themselves"
  on public.story_follows for insert
  with check (auth.uid() = profile_id);

create policy "users unfollow stories as themselves"
  on public.story_follows for delete
  using (auth.uid() = profile_id);

alter table public.author_follows enable row level security;

create policy "author_follows are publicly readable"
  on public.author_follows for select
  using (true);

create policy "users follow authors as themselves"
  on public.author_follows for insert
  with check (auth.uid() = follower_id);

create policy "users unfollow authors as themselves"
  on public.author_follows for delete
  using (auth.uid() = follower_id);

-- =============================================================================
-- reading_progress — fully private to the owner, all four operations.
-- =============================================================================

alter table public.reading_progress enable row level security;

create policy "readers see only their own progress"
  on public.reading_progress for select
  using (auth.uid() = profile_id);

create policy "readers create only their own progress"
  on public.reading_progress for insert
  with check (auth.uid() = profile_id);

create policy "readers update only their own progress"
  on public.reading_progress for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "readers delete only their own progress"
  on public.reading_progress for delete
  using (auth.uid() = profile_id);

-- =============================================================================
-- read_events — append-only; insert allowed for the caller's own reads or
-- guest reads (profile_id is null); select restricted to the row owner.
-- (service_role bypasses RLS entirely, so no explicit policy is needed for
-- the aggregation RPC — it should run as security definer instead.)
-- =============================================================================

alter table public.read_events enable row level security;

create policy "readers or guests log their own read events"
  on public.read_events for insert
  with check (auth.uid() = profile_id or profile_id is null);

create policy "readers see only their own read events"
  on public.read_events for select
  using (auth.uid() = profile_id);

-- No update/delete policy: read_events is append-only. `completed` is set at
-- insert time by the caller when known, or updated later via a
-- security-definer RPC (Phase 4/5) that bypasses this restriction by design.

-- =============================================================================
-- notifications — select/update only by the recipient. NO client insert
-- policy: rows are created only by security-definer triggers (Phase 5),
-- which run as the table owner and are unaffected by RLS.
-- =============================================================================

alter table public.notifications enable row level security;

create policy "recipients read their own notifications"
  on public.notifications for select
  using (auth.uid() = profile_id);

create policy "recipients mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- =============================================================================
-- reports — any authenticated user may insert; no select policy for regular
-- users (otherwise reporters could see each other's reports). Triage happens
-- via Supabase Studio using the service role, which bypasses RLS.
-- =============================================================================

alter table public.reports enable row level security;

create policy "authenticated users file reports as themselves"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- Deliberately no select/update/delete policy for authenticated/anon roles.
