// Checks the tournament data the browser sends before it touches the
// database. The browser builds the bracket (client/src/lib), but the
// browser can be bypassed, so the shape is checked again here.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FORMATS = ['single_elimination', 'double_elimination', 'round_robin']
const SIDES = [null, 'winners', 'losers', 'final', 'third_place']
const STATUSES = ['in_progress', 'complete']

export const isUuid = (value) => typeof value === 'string' && UUID.test(value)

const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const optionalInt = (value, min, max) => value === null || value === undefined || isInt(value, min, max)
const text = (value, max) => (typeof value === 'string' ? value.trim() : '').slice(0, max + 1)

function checkMatch(match, errors, { teamIds, matchIds }) {
  const where = `match ${match?.id ?? '?'}`
  if (!match || typeof match !== 'object') return errors.push('every match must be an object')
  if (!isUuid(match.id)) errors.push(`${where}: id must be a UUID`)
  for (const slot of ['teamA', 'teamB']) {
    const team = match[slot]
    if (team !== null && !(team && teamIds.has(team.id))) errors.push(`${where}: ${slot} is not a player in this tournament`)
  }
  if (match.winnerId !== null && !teamIds.has(match.winnerId)) errors.push(`${where}: winnerId is not a player in this tournament`)
  for (const key of ['scoreA', 'scoreB']) {
    if (!optionalInt(match[key], 0, 9999)) errors.push(`${where}: ${key} must be a whole number from 0 to 9999`)
  }
  for (const key of ['nextMatchId', 'loserNextMatchId']) {
    if (match[key] !== null && !matchIds.has(match[key])) errors.push(`${where}: ${key} points outside this tournament`)
  }
  for (const key of ['nextSlot', 'loserNextSlot']) {
    if (![null, 'A', 'B'].includes(match[key])) errors.push(`${where}: ${key} must be A, B or null`)
  }
  for (const key of ['isBye', 'isVoid', 'isThirdPlace', 'isGrandFinal', 'isReset']) {
    if (typeof match[key] !== 'boolean') errors.push(`${where}: ${key} must be true or false`)
  }
  if (!SIDES.includes(match.bracketSide ?? null)) errors.push(`${where}: unknown bracketSide`)
  if (!isInt(match.round, 0, 100)) errors.push(`${where}: round must be a whole number`)
  if (typeof match.code !== 'string' || match.code.length > 10) errors.push(`${where}: code must be text, 10 characters max`)
}

// A whole tournament, for create (POST) and rebuild (PUT).
export function validateTournament(body) {
  const errors = []
  if (!body || typeof body !== 'object') return { errors: ['body must be a tournament object'] }

  const game = text(body.game, 100)
  const roundName = text(body.roundName ?? '', 100)
  if (!isUuid(body.id)) errors.push('id must be a UUID')
  if (!game) errors.push('game is required')
  if (game.length > 100) errors.push('game must be 100 characters or fewer')
  if (roundName.length > 100) errors.push('event name must be 100 characters or fewer')
  if (!FORMATS.includes(body.format)) errors.push(`format must be one of ${FORMATS.join(', ')}`)
  if (!optionalInt(body.bestOf, 1, 99)) errors.push('bestOf must be empty or a whole number from 1 to 99')
  if (!STATUSES.includes(body.status)) errors.push('status must be in_progress or complete')

  const teams = Array.isArray(body.teams) ? body.teams : []
  if (teams.length < 2 || teams.length > 256) errors.push('a tournament needs 2 to 256 players')
  const teamIds = new Set()
  const names = new Set()
  for (const team of teams) {
    const name = text(team?.name, 100)
    if (!isUuid(team?.id)) errors.push('every player needs a UUID id')
    if (!name || name.length > 100) errors.push('every player needs a name of 1 to 100 characters')
    if (!optionalInt(team?.rank, 1, 9999)) errors.push(`${name}: rank must be empty or a whole number from 1 up`)
    if (!optionalInt(team?.seed, 1, 9999)) errors.push(`${name}: seed must be empty or a whole number from 1 up`)
    if (names.has(name.toLowerCase())) errors.push(`two players are called "${name}"`)
    teamIds.add(team?.id)
    names.add(name.toLowerCase())
  }

  const matches = Array.isArray(body.allMatches) ? body.allMatches : []
  if (matches.length === 0 || matches.length > 2048) errors.push('allMatches must contain 1 to 2048 matches')
  const matchIds = new Set(matches.map((m) => m?.id))
  if (matchIds.size !== matches.length) errors.push('match ids must be unique')
  for (const match of matches) checkMatch(match, errors, { teamIds, matchIds })

  const rounds = Array.isArray(body.rounds) ? body.rounds : []
  const placed = new Set()
  for (const round of rounds) {
    if (typeof round?.label !== 'string' || !round.label || round.label.length > 50) errors.push('every round needs a label of 1 to 50 characters')
    if (!SIDES.includes(round?.side ?? null)) errors.push(`round ${round?.label}: unknown side`)
    if (!optionalInt(round?.bestOf, 1, 99)) errors.push(`round ${round?.label}: bestOf must be empty or 1 to 99`)
    for (const id of Array.isArray(round?.matchIds) ? round.matchIds : []) {
      if (!matchIds.has(id) || placed.has(id)) errors.push(`round ${round?.label}: bad or repeated match id`)
      placed.add(id)
    }
  }
  if (placed.size !== matches.length) errors.push('every match must belong to exactly one round')

  const options = body.options && typeof body.options === 'object' ? body.options : {}
  return {
    errors: [...new Set(errors)].slice(0, 10),
    value: {
      ...body,
      game,
      roundName,
      bestOf: body.bestOf ?? null,
      options: {
        thirdPlace: Boolean(options.thirdPlace),
        random: Boolean(options.random),
        lateBestOf: options.lateBestOf ?? null,
      },
      teams: teams.map((t) => ({ ...t, name: text(t.name, 100), rank: t.rank ?? null, seed: t.seed ?? null })),
    },
  }
}

// A batch of match changes (live score, finish, reopen, round length) for
// PATCH. Team and match ids are checked against the database in the repo.
export function validateChanges(body) {
  const errors = []
  if (!body || typeof body !== 'object') return { errors: ['body must be an object'] }
  if (!STATUSES.includes(body.status)) errors.push('status must be in_progress or complete')
  const matches = Array.isArray(body.matches) ? body.matches : []
  const rounds = Array.isArray(body.rounds) ? body.rounds : []
  if (matches.length > 2048 || rounds.length > 256) errors.push('too many changes in one request')
  // The real ids are checked in the repo; accept any UUIDs here.
  const anyTeam = { has: (id) => isUuid(id) }
  const anyMatch = { has: (id) => isUuid(id) }
  for (const match of matches) checkMatch(match, errors, { teamIds: anyTeam, matchIds: anyMatch })
  for (const round of rounds) {
    if (!isInt(round?.index, 0, 1000)) errors.push('round index must be a whole number')
    if (!optionalInt(round?.bestOf, 1, 99)) errors.push('round bestOf must be empty or 1 to 99')
  }
  return { errors: [...new Set(errors)].slice(0, 10), value: { status: body.status, matches, rounds } }
}
