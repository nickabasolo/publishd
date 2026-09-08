-- Full-text search over stories: a generated tsvector column with a GIN index.
-- Replaces the prototype's join-everything-into-one-string substring search.

alter table public.stories
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(blurb, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(synopsis, '')), 'C')
  ) stored;

create index stories_search_vector_idx on public.stories using gin (search_vector);
