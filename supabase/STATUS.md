# Backend migration — status

Plan: `/Users/nick/.claude/plans/ive-fleshed-out-everything-lexical-deer.md`
Branch: `feat/backend-foundation` (off `feat/author-studio`)

## Done
- **Phase 0** — 9 migrations APPLIED to hosted dev project `ktitknextfavmcixyfak`.
  `npx supabase migration list` confirms local == remote for 0001–0009.
  CLI is logged in and linked; `db push` works non-interactively.
  Fixes made during review: comments INSERT policy now requires the target chapter be
  published and not hidden (was a real hole — anyone with a chapter UUID could plant a
  comment on a draft); `check (slug = lower(slug))` on tags; `[db.seed]` disabled in
  config.toml (pointed at a nonexistent seed.sql).
- **Phase 1** — contract + LocalDataClient + all 8 hooks migrated to TanStack Query.
  `use-active-read.ts` retired → `use-reading-progress.ts`. Build and lint pass.
  `settings.tsx` and `account.tsx` deliberately still on localStorage.
- **Phase 0 verification** — confirmed live against the hosted DB via
  `scripts/db-query.mjs` (new, uses short-lived CLI-issued pooler creds, never prints
  them). All 15 tables exist with RLS enabled; policy counts match spec exactly
  (`notifications` 2, `reports` 1); nullable `chapters.number`, `chapters.hidden`,
  partial unique indexes, `pg_trgm`/`pg_cron` extensions, tsvector search — all present.
  `rls_test.sql` passes (fixed a grant bug in the test fixture itself, not the schema).
- **Phase 2** — `SupabaseDataClient` read paths (stories/chapters/comments/profiles/
  notifications), real Google/Discord OAuth wiring (Apple visible, disabled), row
  mappers, real cursor pagination. Write paths (`comments.add/reply`, `likes.*`,
  `follows.*`, `reading.*`, `studio.*`) intentionally left as `notImplemented` stubs —
  that's Phase 3. Build/lint pass; not yet runtime-tested against live data.
- **Phase 4** — publish pipeline implemented and tested end-to-end
  (`0010_publish_pipeline.sql`, `0011_fix_save_chapter_draft_ambiguous_column.sql`,
  both pushed). Two-pass diff (exact match, then pg_trgm at 0.6), `publish_chapter`/
  `schedule_chapter`/`set_chapter_hidden`/`unpublish_chapter`, `pg_cron` job confirmed
  active. New `supabase/tests/publish_pipeline_test.sql` covers insert/typo/rewrite/
  reorder/schedule/hide/unhide/cross-chapter-comment-rejection — all passing.

## Not yet done
- **`scripts/seed.mjs` has never been run.** Env keys are confirmed present now (see
  below) — this is the natural next step, unblocked.
- Phase 3 (Supabase adapter writes) not started — depends on Phase 2 (done) + Phase 4
  (done), so it can start now.
- Phase 5 (notification triggers, real analytics), Phase 6 (instrumentation), Phase 7
  (cutover) not started.
- Google + Discord OAuth apps not created yet (needed to test Phase 2 auth for real).
- ~29+ changed files uncommitted on `feat/backend-foundation`. User asked about
  committing twice; not yet answered.

## Resolved
- `.env.local` keys are NOT empty — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` all confirmed set (independently verified, values never
  printed). Only `VITE_POSTHOG_KEY` is empty, expected until Phase 6.

## Known gaps
- `psql` not installed; RLS/publish-pipeline tests run via `scripts/db-query.mjs` or the
  dashboard SQL editor instead.
- Nothing has been seeded — the database has schema but zero rows.
- GitHub integration is NOT auto-applying migrations (confirmed: all 9 were pending
  before the manual push). `db push` is the correct workflow.
