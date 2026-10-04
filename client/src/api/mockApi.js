// The simulated backend for demo builds (VITE_USE_MOCK_API not "false").
//
// Same function names and return shapes as httpApi.js, so the rest of the
// app can't tell the difference. Data lives only in this browser.

const KEY = 'tb_tournaments'

// A real network is not instant; keeping a small delay keeps the loading
// states honest.
const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    localStorage.removeItem(KEY)
    return []
  }
}

function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

const copy = (value) => structuredClone(value)

// Demo only: the real server checks a hashed password in the admins table.
export async function login(username, password) {
  await delay()
  if (username === 'admin' && password === '123') return { token: 'demo', username }
  const error = new Error('Incorrect username or password.')
  error.status = 401
  throw error
}

export async function listTournaments() {
  await delay()
  return read()
}

export async function createTournament(tournament) {
  await delay()
  const saved = { ...copy(tournament), createdAt: tournament.createdAt || new Date().toISOString() }
  write([saved, ...read()])
  return saved
}

export async function replaceTournament(tournament) {
  await delay()
  write(read().map((t) => (t.id === tournament.id ? copy(tournament) : t)))
  return copy(tournament)
}

// The real API takes only the changed matches; here the whole tournament
// is simply stored again.
export async function updateTournament(tournament) {
  await delay(0)
  write(read().map((t) => (t.id === tournament.id ? copy(tournament) : t)))
  return null
}

export async function deleteTournament(id) {
  await delay()
  write(read().filter((t) => t.id !== id))
  return null
}

// Players are derived from the stored tournaments (one per name).
export async function listPlayers() {
  await delay(0)
  const players = new Map()
  for (const t of read()) {
    for (const team of t.teams) {
      const key = team.name.toLowerCase()
      if (!players.has(key)) players.set(key, { id: team.id, name: team.name })
    }
  }
  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function renamePlayer({ oldName, name }) {
  await delay()
  const key = oldName.toLowerCase()
  const rename = (team) => (team && team.name.toLowerCase() === key ? { ...team, name } : team)
  write(
    read().map((t) => ({
      ...t,
      teams: t.teams.map(rename),
      allMatches: t.allMatches.map((m) => ({ ...m, teamA: rename(m.teamA), teamB: rename(m.teamB) })),
    }))
  )
  return { name }
}

// Demo mode: other tabs of this browser see changes through the storage event.
export function subscribe(onChange) {
  const handler = (event) => {
    if (event.key === KEY) onChange({ type: 'tournament' })
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

// Nothing to delete: once the tournaments no longer list the player, they
// no longer exist in demo mode.
export async function deletePlayer() {
  await delay()
  return null
}
