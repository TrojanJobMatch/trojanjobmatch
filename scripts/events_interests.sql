-- Adds the "Events for you" interests column. Run ONLY against the TrojanMatch
-- Neon branch. Safe to run twice.
--   psql "$TROJANMATCH_DATABASE_URL" -f scripts/events_interests.sql
alter table tm_users add column if not exists interests text[] not null default '{}';
