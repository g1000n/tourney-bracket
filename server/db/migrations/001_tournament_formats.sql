-- Everything the client's bracket model needs, so a tournament can be saved
-- and loaded back exactly. Safe to run twice.
--
--   cd server && node --env-file=.env db/run.js db/migrations/001_tournament_formats.sql

-- Tournaments ---------------------------------------------------------------

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS format  VARCHAR(30) NOT NULL DEFAULT 'single_elimination',
  -- Default match length: NULL = free score, otherwise best of N.
  ADD COLUMN IF NOT EXISTS best_of INTEGER CHECK (best_of IS NULL OR best_of > 0),
  -- Settings needed to rebuild the bracket (e.g. after removing a player
  -- before play starts): { thirdPlace, random, lateBestOf }.
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Players -------------------------------------------------------------------

-- One player per name, ignoring capitals, so "Ana" and "ana" are the same
-- person across every tournament and game.
CREATE UNIQUE INDEX IF NOT EXISTS players_name_unique ON players (lower(name));

-- Tournament entries ------------------------------------------------------------

-- rank = the seed the admin typed (per tournament, so per game).
-- seed = the seed the player actually got (ranks are ignored when seeding
--        is random).
ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS seed INTEGER CHECK (seed IS NULL OR seed > 0);
ALTER TABLE tournament_players DROP CONSTRAINT IF EXISTS tournament_players_rank_positive;
ALTER TABLE tournament_players
  ADD CONSTRAINT tournament_players_rank_positive CHECK (rank IS NULL OR rank > 0);

-- Matches -------------------------------------------------------------------

ALTER TABLE matches
  -- Where the loser goes: the 3rd-place match in single elimination and the
  -- whole losers bracket in double elimination. Same idea as next_match_id.
  ADD COLUMN IF NOT EXISTS loser_next_match_id UUID REFERENCES matches(id),
  ADD COLUMN IF NOT EXISTS loser_next_slot     VARCHAR(1),
  -- 'winners' | 'losers' | 'final' | 'third_place', NULL for single elim
  -- and round robin.
  ADD COLUMN IF NOT EXISTS bracket_side        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_third_place      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_grand_final      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_reset            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Both sides were byes, so the match never happens.
  ADD COLUMN IF NOT EXISTS is_void             BOOLEAN NOT NULL DEFAULT FALSE,
  -- Match length for this match (copied from its round).
  ADD COLUMN IF NOT EXISTS best_of             INTEGER CHECK (best_of IS NULL OR best_of > 0),
  -- Display code such as R1-2, W2-1, L3-1, GF.
  ADD COLUMN IF NOT EXISTS code                VARCHAR(10),
  -- Which round column the match belongs to (0, 1, 2… in display order) and
  -- its position inside that round. round_number is the round within its
  -- own bracket side.
  ADD COLUMN IF NOT EXISTS round_index         INTEGER,
  ADD COLUMN IF NOT EXISTS position            INTEGER;

-- Live scores are score_a/score_b while winner_id is still NULL.
