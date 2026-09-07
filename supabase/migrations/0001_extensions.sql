-- Extensions required by later migrations.
-- pgcrypto: gen_random_uuid()
-- pg_trgm: trigram similarity, used by the Phase 4 paragraph diff (save_chapter_draft)
-- pg_cron: scheduled publish (publish_due_chapters), wired up in Phase 4
--
-- No explicit `with schema` clause: Supabase-hosted Postgres installs these
-- into its managed `extensions` schema, which is already on every role's
-- search_path, so functions below can call gen_random_uuid()/similarity()
-- unqualified.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_cron;
