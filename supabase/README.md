# Supabase backend

Phase 0 of the real-backend migration (see the project plan's "Schema", "Paragraph
identity", and "Publish pipeline" sections). This directory holds the schema
migrations and RLS policies for the dev/prod Supabase project
(`https://ktitknextfavmcixyfak.supabase.co`, ref `ktitknextfavmcixyfak`).

**Docker is not required for anything below.** Everything here runs against the
hosted project directly — there is no local Supabase stack in this workflow.

## One-time setup

1. Install dependencies at the repo root if you haven't (`supabase` is already a
   devDependency, invoked below via `npx`):

   ```
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key
   from **Settings → API** in the dashboard. `.env.local` is gitignored — never
   commit it.

3. Authenticate the CLI to your Supabase **account**. `link` cannot run before
   this — it fails with "Access token not provided." Opens a browser to
   authorize:

   ```
   npx supabase login
   ```

   (Alternatively, set `SUPABASE_ACCESS_TOKEN` from Account → Access Tokens.)

4. Link the CLI to the hosted **project**. This prompts for the database
   password — a different credential from the login above, found under
   Settings → Database in the dashboard, resettable there if you don't have it:

   ```
   npx supabase link --project-ref ktitknextfavmcixyfak
   ```

Note: the CLI is a project dev dependency, not a global install, so every
command needs the `npx` prefix. A bare `supabase ...` will report
"command not found."

5. **Before pushing the first migration**, check whether Supabase's GitHub
   integration has branching/auto-migrate enabled for this repo (Project
   Settings → Integrations). If it does, merging to the tracked branch applies
   `supabase/migrations/` automatically, which changes the workflow below from
   "run `db push` by hand" to "merge to deploy." Confirm which mode you're in
   before assuming either one.

## Applying migrations

```
npx supabase db push
```

This applies every file in `supabase/migrations/` in order (`0001` through
`0009`) that hasn't already been applied, tracked via the
`supabase_migrations.schema_migrations` table on the remote database. It will
prompt for confirmation before running.

There is no local Postgres here (`supabase db reset` / `supabase start` need
Docker, which this environment doesn't have), so **none of this SQL has been
executed anywhere yet.** Treat the first real `db push` as the actual first
test of every migration file, function body, and policy — see "What's still
unverified" below.

## Seeding dev data

The seed script imports the prototype's demo data (`src/data/stories.json`,
`accounts.ts`, `comments-seed.ts`) into real rows via the Supabase JS client,
using the service role key to create matching `auth.users` rows and bypass RLS.
It is **not** a `supabase/seed.sql` file — `db.seed` is disabled in
`config.toml` for exactly that reason.

1. Get the service role key from **Settings → API** (the "service_role" secret,
   not the anon key) and add it to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`.
   Never commit it, never paste it into chat, never run it against production
   once real users exist — it bypasses every RLS policy in this directory.

2. Run:

   ```
   node --env-file=.env.local scripts/seed.mjs
   ```

The script is idempotent: every row it owns gets an id deterministically
derived from a stable natural key (slug, handle, chapter id, paragraph
ordinal, comment id), and every write is an upsert keyed on that id. Re-running
it updates existing rows in place rather than duplicating them — safe to run
again after pulling new demo data or re-running against a reset database.

## Running the RLS test suite

`supabase/tests/rls_test.sql` is plain SQL (not pgTAP): a set of `do $$ ...
raise exception ... $$` blocks that create throwaway fixtures, switch to the
`anon` / `authenticated` roles via `set local role` + the `request.jwt.claims`
GUC, and assert specific policies hold. Silence (plus a final `NOTICE: ALL RLS
ASSERTIONS PASSED`) means pass; any exception is a real regression. The whole
file runs in one transaction that's rolled back at the end, so it never leaves
fixture rows behind and can be re-run freely.

It needs a connection with enough privilege to insert into `auth.users` and to
`set local role`, which the pooled connection string from `db url` typically
has as the migration-owning role:

```
npx supabase db url
psql "$(npx supabase db url)" -f supabase/tests/rls_test.sql
```

(Or paste the file into the Supabase Studio SQL editor and run it there — same
effect, since Studio's SQL editor runs as a privileged role too.)

## What's still unverified

None of this SQL has ever executed — there has been no Docker, no `db push`,
no way to run anything in this environment. Specifically still unverified
after `db push`:

- That all nine migrations actually apply cleanly in order with no syntax
  errors, missing-object references, or permission issues on the hosted
  project (reviewed carefully by inspection, but inspection isn't execution).
- That `handle_new_user` behaves correctly end-to-end through real Google/
  Discord OAuth signups — the retry-on-collision loop and the various
  metadata-missing fallbacks are logically sound on paper but have not fired
  against a real `auth.users` insert.
- That the RLS test suite in `supabase/tests/rls_test.sql` actually passes —
  it has not been run.
- That `scripts/seed.mjs` succeeds against the real project schema — field
  names, upsert conflict targets, and RPC-free direct writes all match the
  migrations as reviewed, but the script has never executed against a live
  database.
- Performance of the `pg_trgm` GIN index and the `search_vector` GIN index at
  any realistic data volume — untested by construction, since there's no data
  in the database yet.
- Whether `pg_cron` enables cleanly on this project without additional
  dashboard configuration (some Supabase plans/regions need it toggled in
  Database → Extensions before `create extension pg_cron` succeeds).

## Commands to run, in order

```
npx supabase login
npx supabase link --project-ref ktitknextfavmcixyfak
npx supabase db push
node --env-file=.env.local scripts/seed.mjs
psql "$(npx supabase db url)" -f supabase/tests/rls_test.sql
```

`psql` is not installed on this machine. Either `brew install libpq` (no admin
password needed), or skip it and paste `supabase/tests/rls_test.sql` into the
dashboard's SQL editor instead — it runs identically there.

If `db push` fails partway through, fix the offending migration file, then
re-run `db push` — Supabase tracks which migrations already applied and will
only attempt the remainder.
