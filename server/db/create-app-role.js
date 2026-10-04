// Creates (or resets the password of) a restricted database login for the
// running app, "tourney_app", so the app does NOT connect as the owner.
//
//   cd server
//   npm run db:app-role              # create the login, test it, print nothing secret
//   npm run db:app-role -- --write-env
//       ...and also switch server/.env over to it: the current DATABASE_URL
//       becomes OWNER_DATABASE_URL (used only by setup scripts) and
//       DATABASE_URL becomes the restricted login. A backup of .env is kept.
//
// What tourney_app can do: read and write tournaments, players,
// tournament_players and matches; read admins (to check logins). What it
// can't: create or change admins, empty (TRUNCATE) tables, change the schema,
// or read anything else. Row Level Security stays on; tourney_app gets
// policies for exactly those tables.

import './owner.js'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import pg from 'pg'
import { pool } from './pool.js'

const ROLE = 'tourney_app'
const APP_TABLES = ['tournaments', 'players', 'tournament_players', 'matches']
const writeEnv = process.argv.includes('--write-env')

// The new login's connection string: the owner's, with the user and
// password swapped. Supabase's pooler names users "<role>.<project-ref>".
function appUrl(ownerUrl, password) {
  const url = new URL(ownerUrl)
  const [, projectRef] = decodeURIComponent(url.username).split('.')
  url.username = projectRef ? `${ROLE}.${projectRef}` : ROLE
  url.password = password
  return url.toString()
}

try {
  const ownerUrl = process.env.DATABASE_URL
  const password = randomBytes(24).toString('base64url')

  const exists = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROLE])
  const { rows } = await pool.query(
    `SELECT format(${exists.rowCount ? "'ALTER ROLE %I WITH LOGIN PASSWORD %L'" : "'CREATE ROLE %I WITH LOGIN PASSWORD %L'"}, $1::text, $2::text) AS sql`,
    [ROLE, password]
  )
  await pool.query(rows[0].sql)

  await pool.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`)
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${APP_TABLES.join(', ')} TO ${ROLE}`)
  await pool.query(`GRANT SELECT ON admins TO ${ROLE}`)
  for (const table of APP_TABLES) {
    await pool.query(`DROP POLICY IF EXISTS ${ROLE}_all ON ${table}`)
    await pool.query(`CREATE POLICY ${ROLE}_all ON ${table} FOR ALL TO ${ROLE} USING (true) WITH CHECK (true)`)
  }
  await pool.query(`DROP POLICY IF EXISTS ${ROLE}_read ON admins`)
  await pool.query(`CREATE POLICY ${ROLE}_read ON admins FOR SELECT TO ${ROLE} USING (true)`)
  console.log(`Login "${ROLE}" ready, with access to ${APP_TABLES.join(', ')} and read-only admins.`)

  // Prove the new login works, and that it really is limited.
  const url = appUrl(ownerUrl, password)
  const local = url.includes('localhost') || url.includes('127.0.0.1')
  const test = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })
  await test.connect()
  await test.query('SELECT count(*) FROM tournaments')
  await test.query('SELECT count(*) FROM admins')
  let blocked = false
  try {
    await test.query('TRUNCATE matches')
  } catch {
    blocked = true
  }
  await test.end()
  if (!blocked) throw new Error(`${ROLE} was able to TRUNCATE; not switching to it.`)
  console.log('Tested: it can read the tables, and it is refused when it tries to empty one.')

  if (writeEnv) {
    const envPath = new URL('../.env', import.meta.url)
    const backup = new URL(`../.env.backup-${Date.now()}`, import.meta.url)
    copyFileSync(envPath, backup)
    let env = readFileSync(envPath, 'utf8')
    if (!/^OWNER_DATABASE_URL=/m.test(env)) {
      env = env.replace(/^DATABASE_URL=/m, 'OWNER_DATABASE_URL=')
      env = `${env.trimEnd()}\n\n# The running app's restricted login (see db/create-app-role.js).\nDATABASE_URL=${url}\n`
    } else {
      env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`)
    }
    writeFileSync(envPath, env)
    console.log('server/.env updated: DATABASE_URL is now the restricted login; the owner login is OWNER_DATABASE_URL.')
    console.log(`A backup of the old .env was saved next to it (${backup.pathname.split('/').pop()}). Restart the server.`)
  } else {
    console.log('Nothing written. Run again with --write-env to switch server/.env to this login.')
  }
} catch (error) {
  console.error(`Could not set up the app login: ${error.message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
