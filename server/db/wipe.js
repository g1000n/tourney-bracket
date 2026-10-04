// Deletes ALL tournaments, matches and players. Admin accounts are kept, so
// you can still log in afterwards. There is no undo.
//
//   cd server
//   npm run db:wipe
//
// It asks you to type DELETE EVERYTHING first, and shows which database it
// is about to empty (host only, never the password).

import './owner.js'
import readline from 'node:readline'
import { pool } from './pool.js'

const host = new URL(process.env.DATABASE_URL).hostname
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

try {
  const { rows } = await pool.query(`
    SELECT (SELECT count(*) FROM tournaments)::int AS tournaments,
           (SELECT count(*) FROM players)::int     AS players,
           (SELECT count(*) FROM matches)::int     AS matches`)
  const counts = rows[0]
  console.log(`Database: ${host}`)
  console.log(`This deletes ${counts.tournaments} tournaments, ${counts.matches} matches and ${counts.players} players. Admins are kept.`)
  const answer = await new Promise((resolve) => rl.question('Type DELETE EVERYTHING to continue: ', resolve))
  if (answer.trim() !== 'DELETE EVERYTHING') {
    console.log('Cancelled. Nothing was deleted.')
  } else {
    await pool.query('TRUNCATE matches, tournament_players, tournaments, players')
    console.log('Done. All tournaments, matches and players are gone; admin accounts are untouched.')
  }
} catch (error) {
  console.error(`Could not wipe the data: ${error.message}`)
  process.exitCode = 1
} finally {
  rl.close()
  await pool.end()
}
