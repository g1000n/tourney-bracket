// The data-access layer for admin accounts.

export async function getByUsername(pool, username) {
  const result = await pool.query(`
    SELECT * FROM admins
    WHERE username = $1`, [username])
  return result.rows[0] ?? null
}

export async function save(pool, admin) {
  const result = await pool.query(`
    INSERT INTO admins (username, password_hash)
    VALUES ($1, $2)
    ON CONFLICT (username) DO UPDATE
    SET password_hash = EXCLUDED.password_hash
    RETURNING id, username`,
    [admin.username, admin.password_hash])
  return result.rows[0]
}