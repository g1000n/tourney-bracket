// The real client. Every function here talks to the Express API.
//
// mockApi.js has the same functions backed by localStorage, for demo builds
// that have no server. api/index.js picks one.

const BASE = import.meta.env.VITE_API_BASE_URL || ''

export const ADMIN_TOKEN_KEY = 'adminToken'

// Identifies this browser tab on its saves, so it can ignore the live-update
// echo of its own changes.
const CLIENT_ID = crypto.randomUUID()

async function request(path, options = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY)
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': CLIENT_ID,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch {
    throw new Error("Can't reach the server. Check that the API is running.")
  }

  if (!response.ok) {
    // Try to use the API's own message; fall back to the status line.
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // The body was not JSON. The status line is all we have.
    }
    // An expired or missing admin login: drop it so the admin controls hide.
    if (response.status === 401 && token) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      sessionStorage.removeItem('isAdmin')
      message = 'Your admin login has expired. Log in again.'
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return response.status === 204 ? null : response.json()
}

const send = (method, body) => ({ method, body: JSON.stringify(body) })

// Logging in creates a session; the server answers with a signed token.
export const login = (username, password) => request('/api/sessions', send('POST', { username, password }))

export const listTournaments = () => request('/api/tournaments')

export const createTournament = (tournament) => request('/api/tournaments', send('POST', tournament))

// Rebuild a bracket that hasn't started (e.g. after removing a player).
export const replaceTournament = (tournament) => request(`/api/tournaments/${tournament.id}`, send('PUT', tournament))

// Save only what one action changed: { status, matches, rounds }.
export const updateTournament = (tournament, changes) =>
  request(`/api/tournaments/${tournament.id}`, send('PATCH', changes))

export const deleteTournament = (id) => request(`/api/tournaments/${id}`, { method: 'DELETE' })

export const listPlayers = () => request('/api/players')

export const renamePlayer = ({ id, name }) => request(`/api/players/${id}`, send('PATCH', { name }))

export const deletePlayer = ({ id }) => request(`/api/players/${id}`, { method: 'DELETE' })

// Live updates: calls onChange(event) whenever someone else changes data.
// The browser reconnects by itself if the connection drops; after a
// reconnect onChange is called once too, in case something was missed.
// Returns a function that stops listening.
export function subscribe(onChange) {
  const source = new EventSource(`${BASE}/api/events`)
  let opened = false
  source.onopen = () => {
    if (opened) onChange({ type: 'reconnected' })
    opened = true
  }
  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data)
      if (event.origin !== CLIENT_ID) onChange(event)
    } catch {
      // Ignore anything that isn't one of our messages.
    }
  }
  return () => source.close()
}
