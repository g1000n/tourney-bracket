-- Closes Supabase's public Data API (the anon / authenticated roles) to
-- every table. Safe to run twice.
--
--   cd server && npm run db:lock
--
-- Why: this app never uses Supabase's public API. All access goes through
-- the Express server, which connects as the table owner. Row Level Security
-- (enabled in schema.sql, no policies) already blocks those roles from
-- reading and writing rows. But Supabase also grants them table privileges
-- by default, including TRUNCATE, which RLS does not cover. Removing the
-- grants means they can do nothing at all, even if an RLS policy is added
-- by mistake later.
--
-- The Express server is unaffected: it does not use these roles.

REVOKE ALL ON TABLE admins, tournaments, players, tournament_players, matches FROM anon, authenticated;

-- Tables created later by this role in the public schema start locked too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- The admins table uses a SERIAL id, so it has a sequence too.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
