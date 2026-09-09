-- Onboarding confirmation dialog support.
--
-- Adds a nullable `onboarded_at` timestamp to `profiles`. Null means the
-- account has never seen the onboarding confirm-or-edit dialog (shown once
-- per account after first sign-in, same non-blocking UX shape as the
-- consent banner — see src/components/onboarding-dialog.tsx). The client
-- sets this the moment the dialog is dismissed OR saved; either counts as
-- "seen it". No default backfill needed — existing rows simply get null,
-- which is the correct "hasn't seen it yet" state for accounts created
-- before this column existed too.
alter table public.profiles
  add column onboarded_at timestamptz;
