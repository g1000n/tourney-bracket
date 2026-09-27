-- The complete shape of the database. Safe to run against an empty database,
-- and safe to run twice.
--
-- This file is committed on purpose. The database structure should be readable
-- here instead of only existing inside the hosted database.

-- There is only one admin for this project, so there is no public signup.
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores the basic information for each tournament.
CREATE TABLE IF NOT EXISTS tournaments (
  id         UUID PRIMARY KEY,
  game       VARCHAR(100) NOT NULL,
  round_name VARCHAR(100),
  status     VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Players are stored separately so they can be used by both tournaments
-- and matches.
CREATE TABLE IF NOT EXISTS players (
  id   UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

-- Connects players to tournaments. Rank is stored here because a player's
-- rank can be different from one tournament to another.
CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rank          INTEGER,
  PRIMARY KEY (tournament_id, player_id)
);

-- Stores each match and the information needed to build and update the
-- bracket.
CREATE TABLE IF NOT EXISTS matches (
  id            UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number  INTEGER NOT NULL,
  round_label   VARCHAR(50) NOT NULL,
  team_a_id     UUID REFERENCES players(id),
  team_b_id     UUID REFERENCES players(id),
  score_a       INTEGER,
  score_b       INTEGER,
  winner_id     UUID REFERENCES players(id),
  next_match_id UUID REFERENCES matches(id),
  next_slot     VARCHAR(1),
  is_bye        BOOLEAN NOT NULL DEFAULT FALSE
);

-- These are used when looking up all matches or players for a tournament.
CREATE INDEX IF NOT EXISTS idx_matches_tournament
  ON matches (tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament
  ON tournament_players (tournament_id);

-- The Express server handles access to these tables. RLS is also enabled as
-- an extra safeguard in case the tables are exposed through Supabase later.
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;