-- profiles: mirrors auth.users 1:1, created by an `on auth.users insert` trigger.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_color text not null default '#6366f1',
  bio text not null default '',
  favorite_genres text[] not null default '{}',
  is_author boolean not null default false,
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on username, plus a plain unique constraint so
-- ON CONFLICT (username) works from the seed script and future upserts.
create unique index profiles_username_key on public.profiles (username);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: profiles are never client-deleted. `deactivated_at` exists
-- so a future soft-delete flow doesn't require a migration.

-- ---------------------------------------------------------------------------
-- handle_new_user: creates the profile row when a new auth.users row appears.
--
-- Username generation is the fragile part of social signup, so it is fully
-- spelled out here:
--   1. Prefer `raw_user_meta_data->>'full_name'`, then `'name'`, then the
--      local part of the email, then a hardcoded fallback ("user") if every
--      source is absent or blank.
--   2. Slugify: lowercase, strip anything that isn't [a-z0-9], collapse to a
--      single string. Empty result after stripping falls back to "user".
--   3. Truncate to a sane length so the retry suffix always fits.
--   4. Attempt the insert. On a unique-violation on username, retry with a
--      random 4-character suffix, up to a bounded number of attempts, then
--      fall back to a fully random handle so signup can never hard-fail on
--      this alone.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_source text;
  base_slug text;
  candidate text;
  suffix text;
  attempt int := 0;
  max_attempts constant int := 8;
  display text;
begin
  -- Pick the first non-blank source for both the slug seed and display name.
  raw_source := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(split_part(new.email, '@', 1)), ''),
    'user'
  );

  display := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    raw_source
  );

  -- Slugify: lowercase, strip everything but [a-z0-9], collapse.
  base_slug := lower(regexp_replace(raw_source, '[^a-zA-Z0-9]+', '', 'g'));

  if base_slug is null or length(base_slug) = 0 then
    base_slug := 'user';
  end if;

  -- Leave room for an underscore + 4-char suffix within a reasonable handle length.
  base_slug := left(base_slug, 20);
  candidate := base_slug;

  loop
    begin
      insert into public.profiles (id, username, display_name)
      values (new.id, candidate, display);
      exit; -- success
    exception
      when unique_violation then
        attempt := attempt + 1;

        if attempt > max_attempts then
          -- Last resort: a fully random handle, guaranteed-fresh enough that
          -- a further collision is astronomically unlikely. If it still
          -- collides, let the exception propagate rather than loop forever.
          candidate := 'user_' || replace(gen_random_uuid()::text, '-', '');
          insert into public.profiles (id, username, display_name)
          values (new.id, candidate, display);
          exit;
        end if;

        suffix := lpad((floor(random() * 10000))::int::text, 4, '0');
        candidate := base_slug || '_' || suffix;
    end;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
