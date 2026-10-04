// The data-access layer for tournament entries.
// This table connects players to tournaments and stores their rank and seed.

export async function getAll(pool) {
  const result = await pool.query(`
    SELECT tp.tournament_id, tp.player_id, tp.rank, tp.seed, p.name
    FROM tournament_players tp
    JOIN players p ON p.id = tp.player_id`)
  return result.rows
}

export async function getByTournament(pool, tournamentId) {
  const result = await pool.query(`
    SELECT tp.tournament_id, tp.player_id, tp.rank, tp.seed, p.name
    FROM tournament_players tp
    JOIN players p ON p.id = tp.player_id
    WHERE tp.tournament_id = $1`, [tournamentId])
  return result.rows
}

export async function createMany(pool, tournamentId, entries) {
  for (const entry of entries) {
    await pool.query(`
      INSERT INTO tournament_players
        (tournament_id, player_id, rank, seed)
      VALUES ($1, $2, $3, $4)`,
      [tournamentId, entry.player_id, entry.rank, entry.seed])
  }
}

export async function removeByTournament(pool, tournamentId) {
  await pool.query(`
    DELETE FROM tournament_players
    WHERE tournament_id = $1`, [tournamentId])
}