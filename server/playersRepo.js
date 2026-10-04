// The data-access layer for players.

export async function getAll(pool) {
  const result = await pool.query(`
    SELECT * FROM players
    ORDER BY name`)
  return result.rows
}

export async function getById(pool, id) {
  const result = await pool.query(`
    SELECT * FROM players
    WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

export async function create(pool, player) {
  const result = await pool.query(`
    INSERT INTO players (id, name)
    VALUES ($1, $2)
    RETURNING *`,
    [player.id, player.name])
  return result.rows[0]
}

export async function update(pool, id, player) {
  const result = await pool.query(`
    UPDATE players
    SET name = $2
    WHERE id = $1
    RETURNING *`,
    [id, player.name])
  return result.rows[0] ?? null
}

export async function remove(pool, id) {
  const result = await pool.query(`
    DELETE FROM players
    WHERE id = $1
    RETURNING id`, [id])
  return result.rowCount > 0
}

export async function getStats(pool, id) {
  const result = await pool.query(`
    SELECT t.game,
           COUNT(*)::int AS played,
           COUNT(*) FILTER (WHERE m.winner_id = $1)::int AS wins,
           COUNT(*) FILTER (WHERE m.winner_id <> $1)::int AS losses
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.winner_id IS NOT NULL
      AND m.is_bye = false
      AND (m.team_a_id = $1 OR m.team_b_id = $1)
    GROUP BY t.game
    ORDER BY t.game`, [id])
  return result.rows
}

export async function getByNames(pool, names) {
  const lowerNames = names.map((name) => name.toLowerCase())

  const result = await pool.query(`
    SELECT *
    FROM players
    WHERE lower(name) = ANY($1)`, [lowerNames])

  return result.rows
}