// The data-access layer, the same shape as the course template.
// Every query is parameterised: values go in the array, never into the string.

export async function getAll(pool) {
  const result = await pool.query(`
    SELECT * FROM tournaments
    ORDER BY created_at DESC`)
  return result.rows
}

export async function getById(pool,id) {
  const result = await pool.query(`
    SELECT * FROM tournaments
    WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

export async function create(pool,tournament) {
  const result = await pool.query(`
    INSERT INTO tournaments (id, game, round_name, status)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [tournament.id, tournament.game, tournament.round_name, tournament.status])
  return result.rows[0]
}

export async function remove(pool,id) {
  const result = await pool.query(`
    DELETE FROM tournaments
    WHERE id = $1
    RETURNING id`, [id])
  return result.rowCount > 0
}

// Added by Claude Code: saves a tournament's status and settings (format,
// default match length, and the options needed to rebuild its bracket).
export async function update(pool, id, tournament) {
  const result = await pool.query(`
    UPDATE tournaments
    SET status = $2, format = $3, best_of = $4, options = $5
    WHERE id = $1
    RETURNING *`,
    [id, tournament.status, tournament.format, tournament.best_of, JSON.stringify(tournament.options)])
  return result.rows[0] ?? null
}
