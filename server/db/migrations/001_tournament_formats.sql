-- Adds what the three tournament formats need. Safe to run twice.
--
--   node --env-file=.env db/run.js db/migrations/001_tournament_formats.sql

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS format VARCHAR(30) NOT NULL DEFAULT 'single_elimination';

-- Where the loser goes: the 3rd-place match in single elimination, and the
-- whole losers bracket in double elimination. Same idea as next_match_id.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS loser_next_match_id UUID REFERENCES matches(id),
  ADD COLUMN IF NOT EXISTS loser_next_slot     VARCHAR(1),
  ADD COLUMN IF NOT EXISTS is_third_place      BOOLEAN NOT NULL DEFAULT FALSE,
  -- 'winners' | 'losers' | 'final' | 'third_place', NULL for single elim
  -- and round robin. The grand final is round_number 0 of 'final', the
  -- reset is round_number 1.
  ADD COLUMN IF NOT EXISTS bracket_side        VARCHAR(20);

-- Match length per match (copied from its round): NULL = free score,
-- otherwise best of N. Live scores use the existing score_a/score_b while
-- winner_id is still NULL.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS best_of INTEGER CHECK (best_of IS NULL OR best_of > 0);

-- The seed a player actually got (rank is only the seeding hint, and is
-- ignored when seeding is random).
ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS seed INTEGER CHECK (seed IS NULL OR seed > 0);
ALTER TABLE tournament_players
  DROP CONSTRAINT IF EXISTS tournament_players_rank_positive;
ALTER TABLE tournament_players
  ADD CONSTRAINT tournament_players_rank_positive CHECK (rank IS NULL OR rank > 0);
