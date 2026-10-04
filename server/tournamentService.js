// Whole tournaments: a tournament plus its entries and matches, in the shape
// the React client uses. The repos each talk to one table; this file
// combines them, and runs every multi-table change in one transaction so it
// either fully happens or doesn't happen at all.

import * as tournaments from './tournamentsRepo.js'
import * as players from './playersRepo.js'
import * as entries from './entriesRepo.js'
import * as matches from './matchesRepo.js'
import { HttpError } from './httpError.js'

async function inTransaction(pool, work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function groupBy(list, keyOf) {
  const groups = new Map()
  for (const item of list) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}

// ---------------------------------------------------------------------------
// Database rows -> the client's tournament object
// ---------------------------------------------------------------------------

const SIDE_ORDER = { winners: 0, null: 0, losers: 1, final: 2, third_place: 3 }

// Matches saved before round_index existed are grouped by side + round.
const roundKey = (m) => (m.round_index !== null ? m.round_index : (SIDE_ORDER[m.bracket_side] ?? 0) * 1000 + m.round_number)

function toClient(row, entryRows, matchRows) {
  const teams = entryRows
    .map((e) => ({ id: e.player_id, name: e.name, rank: e.rank, seed: e.seed }))
    .sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9) || a.name.localeCompare(b.name))
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const team = (id) => (id ? teamById.get(id) ?? null : null)

  const sorted = [...matchRows].sort(
    (a, b) => roundKey(a) - roundKey(b) || (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id)
  )
  const rounds = []
  const byKey = new Map()
  for (const m of sorted) {
    const key = roundKey(m)
    if (!byKey.has(key)) {
      const round = { label: m.round_label, side: m.bracket_side ?? null, matchIds: [], bestOf: m.best_of ?? null }
      byKey.set(key, round)
      rounds.push(round)
    }
    byKey.get(key).matchIds.push(m.id)
  }

  return {
    id: row.id,
    game: row.game,
    roundName: row.round_name ?? '',
    name: row.round_name ? `${row.game} — ${row.round_name}` : row.game,
    format: row.format,
    bestOf: row.best_of,
    options: row.options ?? {},
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    teams,
    rounds,
    allMatches: sorted.map((m) => ({
      id: m.id,
      code: m.code ?? `R${m.round_number + 1}-${byKey.get(roundKey(m)).matchIds.indexOf(m.id) + 1}`,
      round: m.round_number,
      bracketSide: m.bracket_side ?? null,
      teamA: team(m.team_a_id),
      teamB: team(m.team_b_id),
      scoreA: m.score_a,
      scoreB: m.score_b,
      winnerId: m.winner_id,
      nextMatchId: m.next_match_id,
      nextSlot: m.next_slot,
      loserNextMatchId: m.loser_next_match_id,
      loserNextSlot: m.loser_next_slot,
      isBye: m.is_bye,
      isVoid: m.is_void,
      isThirdPlace: m.is_third_place,
      isGrandFinal: m.is_grand_final,
      isReset: m.is_reset,
    })),
  }
}

// The client's match -> the columns matchesRepo saves.
function toRow(m, round, index, position) {
  return {
    id: m.id,
    round_number: m.round,
    round_label: round.label,
    round_index: index,
    position,
    code: m.code,
    bracket_side: m.bracketSide ?? null,
    best_of: round.bestOf ?? null,
    team_a_id: m.teamA?.id ?? null,
    team_b_id: m.teamB?.id ?? null,
    score_a: m.scoreA,
    score_b: m.scoreB,
    winner_id: m.winnerId,
    is_bye: m.isBye,
    is_void: m.isVoid,
    is_third_place: m.isThirdPlace,
    is_grand_final: m.isGrandFinal,
    is_reset: m.isReset,
    next_match_id: m.nextMatchId,
    next_slot: m.nextSlot,
    loser_next_match_id: m.loserNextMatchId,
    loser_next_slot: m.loserNextSlot,
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function list(pool) {
  const [rows, entryRows, matchRows] = await Promise.all([
    tournaments.getAll(pool),
    entries.getAll(pool),
    matches.getAll(pool),
  ])
  const entriesBy = groupBy(entryRows, (e) => e.tournament_id)
  const matchesBy = groupBy(matchRows, (m) => m.tournament_id)
  return rows.map((row) => toClient(row, entriesBy.get(row.id) ?? [], matchesBy.get(row.id) ?? []))
}

export async function get(pool, id) {
  const row = await tournaments.getById(pool, id)
  if (!row) return null
  const [entryRows, matchRows] = await Promise.all([entries.getByTournament(pool, id), matches.getByTournament(pool, id)])
  return toClient(row, entryRows, matchRows)
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Players are matched by name, ignoring capitals: an existing player keeps
// their id and history, and a new name becomes a new player. Returns the
// tournament with the browser's made-up player ids swapped for real ones.
async function withRealPlayers(client, t) {
  const found = await players.getByNames(client, t.teams.map((team) => team.name))
  const byName = new Map(found.map((p) => [p.name.toLowerCase(), p]))
  for (const team of t.teams) {
    if (!byName.has(team.name.toLowerCase())) {
      const created = await players.create(client, { id: team.id, name: team.name })
      byName.set(created.name.toLowerCase(), created)
    }
  }
  const real = new Map(t.teams.map((team) => [team.id, byName.get(team.name.toLowerCase())]))
  const swap = (team) => (team ? { ...team, id: real.get(team.id).id, name: real.get(team.id).name } : null)
  return {
    ...t,
    teams: t.teams.map(swap),
    allMatches: t.allMatches.map((m) => ({
      ...m,
      teamA: swap(m.teamA),
      teamB: swap(m.teamB),
      winnerId: m.winnerId ? real.get(m.winnerId).id : null,
    })),
  }
}

async function saveBracket(client, t) {
  await entries.createMany(client, t.id, t.teams.map((p) => ({ player_id: p.id, rank: p.rank, seed: p.seed })))
  const where = new Map()
  t.rounds.forEach((round, index) => round.matchIds.forEach((id, position) => where.set(id, { round, index, position })))
  const rows = t.allMatches.map((m) => {
    const { round, index, position } = where.get(m.id)
    return toRow(m, round, index, position)
  })
  await matches.createMany(client, t.id, rows)
  await matches.linkMany(client, t.id, rows)
}

const settingsOf = (t) => ({ status: t.status, format: t.format, best_of: t.bestOf, options: t.options })

export async function create(pool, tournament) {
  await inTransaction(pool, async (client) => {
    const t = await withRealPlayers(client, tournament)
    await tournaments.create(client, { id: t.id, game: t.game, round_name: t.roundName || null, status: t.status })
    await tournaments.update(client, t.id, settingsOf(t))
    await saveBracket(client, t)
  })
  return get(pool, tournament.id)
}

// Rebuilds a bracket from scratch, e.g. after removing a player. Refused
// once any match has a score or result.
export async function replace(pool, id, tournament) {
  await inTransaction(pool, async (client) => {
    if (!(await tournaments.getById(client, id))) throw new HttpError(404, 'Tournament not found')
    if (await matches.hasResults(client, id)) {
      throw new HttpError(409, 'This tournament has already started, so its bracket can no longer be rebuilt.')
    }
    const t = await withRealPlayers(client, { ...tournament, id })
    await matches.removeByTournament(client, id)
    await entries.removeByTournament(client, id)
    await tournaments.update(client, id, settingsOf(t))
    await saveBracket(client, t)
  })
  return get(pool, id)
}

// Saves what one action changed: some matches, the status, and maybe a
// round's match length.
export async function update(pool, id, { status, matches: changed, rounds }) {
  await inTransaction(pool, async (client) => {
    const row = await tournaments.getById(client, id)
    if (!row) throw new HttpError(404, 'Tournament not found')

    const inTournament = new Set((await entries.getByTournament(client, id)).map((e) => e.player_id))
    for (const m of changed) {
      for (const playerId of [m.teamA?.id, m.teamB?.id, m.winnerId]) {
        if (playerId && !inTournament.has(playerId)) {
          throw new HttpError(400, 'A match refers to a player who is not in this tournament.')
        }
      }
    }

    if (changed.length) {
      const updated = await matches.updateMany(
        client,
        id,
        changed.map((m) => ({
          id: m.id,
          team_a_id: m.teamA?.id ?? null,
          team_b_id: m.teamB?.id ?? null,
          score_a: m.scoreA,
          score_b: m.scoreB,
          winner_id: m.winnerId,
          is_bye: m.isBye,
          is_void: m.isVoid,
        }))
      )
      if (updated !== changed.length) throw new HttpError(400, 'Some matches do not belong to this tournament.')
    }
    for (const round of rounds) await matches.updateRoundLength(client, id, round.index, round.bestOf ?? null)
    await tournaments.update(client, id, { status, format: row.format, best_of: row.best_of, options: row.options })
  })
}

export const remove = (pool, id) => tournaments.remove(pool, id)
