// The data-access layer for matches.
// Every query is parameterised: values go in the array, never into the string.
//
// The "Many" functions save a whole list of rows in ONE query: the list goes
// in as one JSON value and jsonb_to_recordset turns it back into rows. A
// 64-match bracket is then one trip to the database instead of 64.

export async function getAll(pool) {
  const result = await pool.query(`
    SELECT * FROM matches`)
  return result.rows
}

export async function getByTournament(pool, tournamentId) {
  const result = await pool.query(`
    SELECT * FROM matches
    WHERE tournament_id = $1`, [tournamentId])
  return result.rows
}

// Inserts the matches WITHOUT their links (next_match_id and friends): a
// link points at another match, which may not exist yet. linkMany adds them.
export async function createMany(pool, tournamentId, rows) {
  await pool.query(`
    INSERT INTO matches (id, tournament_id, round_number, round_label, round_index, position, code,
                         bracket_side, best_of, team_a_id, team_b_id, score_a, score_b, winner_id,
                         is_bye, is_void, is_third_place, is_grand_final, is_reset)
    SELECT x.id, $1, x.round_number, x.round_label, x.round_index, x.position, x.code,
           x.bracket_side, x.best_of, x.team_a_id, x.team_b_id, x.score_a, x.score_b, x.winner_id,
           x.is_bye, x.is_void, x.is_third_place, x.is_grand_final, x.is_reset
    FROM jsonb_to_recordset($2::jsonb) AS x(
      id uuid, round_number int, round_label text, round_index int, position int, code text,
      bracket_side text, best_of int, team_a_id uuid, team_b_id uuid, score_a int, score_b int,
      winner_id uuid, is_bye boolean, is_void boolean, is_third_place boolean,
      is_grand_final boolean, is_reset boolean)`,
    [tournamentId, JSON.stringify(rows)])
}

// Where each match's winner and loser go next.
export async function linkMany(pool, tournamentId, rows) {
  await pool.query(`
    UPDATE matches m
    SET next_match_id = x.next_match_id, next_slot = x.next_slot,
        loser_next_match_id = x.loser_next_match_id, loser_next_slot = x.loser_next_slot
    FROM jsonb_to_recordset($2::jsonb) AS x(
      id uuid, next_match_id uuid, next_slot text, loser_next_match_id uuid, loser_next_slot text)
    WHERE m.id = x.id AND m.tournament_id = $1`,
    [tournamentId, JSON.stringify(rows)])
}

// Saves players, scores and results. Returns how many matches were updated,
// so the caller can tell if one didn't belong to this tournament.
export async function updateMany(pool, tournamentId, rows) {
  const result = await pool.query(`
    UPDATE matches m
    SET team_a_id = x.team_a_id, team_b_id = x.team_b_id, score_a = x.score_a, score_b = x.score_b,
        winner_id = x.winner_id, is_bye = x.is_bye, is_void = x.is_void
    FROM jsonb_to_recordset($2::jsonb) AS x(
      id uuid, team_a_id uuid, team_b_id uuid, score_a int, score_b int, winner_id uuid,
      is_bye boolean, is_void boolean)
    WHERE m.id = x.id AND m.tournament_id = $1`,
    [tournamentId, JSON.stringify(rows)])
  return result.rowCount
}

// A round's match length (best of N; null = free score).
export async function updateRoundLength(pool, tournamentId, roundIndex, bestOf) {
  await pool.query(`
    UPDATE matches SET best_of = $3
    WHERE tournament_id = $1 AND round_index = $2`,
    [tournamentId, roundIndex, bestOf])
}

// True once any match has a real result or a live score.
export async function hasResults(pool, tournamentId) {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM matches
      WHERE tournament_id = $1
        AND ((winner_id IS NOT NULL AND NOT is_bye) OR score_a IS NOT NULL OR score_b IS NOT NULL)
    ) AS started`, [tournamentId])
  return result.rows[0].started
}

export async function removeByTournament(pool, tournamentId) {
  await pool.query(`
    DELETE FROM matches
    WHERE tournament_id = $1`, [tournamentId])
}
