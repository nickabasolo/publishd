-- stories.public_id: a short, random, numeric public identifier for stories,
-- used for reader-facing URLs instead of the internal UUID (too long) or the
-- human-readable slug (duplicate-title concerns, breaks on title changes).
--
-- Deliberately NOT sequential/auto-increment: a counting id leaks total
-- content volume and makes the catalog trivially scrapable (story 1, story
-- 2, story 3, ...). Instead it's a uniformly random 9-digit integer
-- (100000000..999999999 — ~900M possible values), generated at insert time
-- with a retry-on-collision loop, following the same pattern as
-- `handle_new_user`'s username-collision retry in 0002_profiles.sql.

alter table public.stories
  add column public_id bigint;

-- ---------------------------------------------------------------------------
-- generate_story_public_id: picks a random 9-digit value and retries on
-- collision, bounded, with a fully-random fallback so insert can never
-- hard-fail on this alone (mirrors handle_new_user's shape).
-- ---------------------------------------------------------------------------

create or replace function public.generate_story_public_id()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate bigint;
  attempt int := 0;
  max_attempts constant int := 12;
begin
  loop
    candidate := floor(random() * 900000000 + 100000000)::bigint;

    if not exists (select 1 from public.stories where public_id = candidate) then
      return candidate;
    end if;

    attempt := attempt + 1;
    if attempt > max_attempts then
      -- Last resort: widen into the low end of the bigint range so a further
      -- collision is astronomically unlikely. Still numeric-looking, just a
      -- couple of digits longer.
      loop
        candidate := floor(random() * 9000000000000::bigint + 1000000000000::bigint)::bigint;
        if not exists (select 1 from public.stories where public_id = candidate) then
          return candidate;
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- before-insert trigger: assigns public_id automatically when not supplied.
-- ---------------------------------------------------------------------------

create or replace function public.assign_story_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_id is null then
    new.public_id := public.generate_story_public_id();
  end if;
  return new;
end;
$$;

create trigger stories_assign_public_id
  before insert on public.stories
  for each row execute function public.assign_story_public_id();

-- ---------------------------------------------------------------------------
-- Backfill existing rows, then lock the column down.
-- ---------------------------------------------------------------------------

update public.stories
set public_id = public.generate_story_public_id()
where public_id is null;

alter table public.stories
  alter column public_id set not null;

create unique index stories_public_id_key on public.stories (public_id);
