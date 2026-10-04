import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pool } from './db/pool.js'
import { randomUUID } from 'node:crypto'
import * as tournamentService from './tournamentService.js'
import * as players from './playersRepo.js'
import * as admins from './adminsRepo.js'
import { HttpError } from './httpError.js'
import {
  requireAdmin,
  verifyPassword,
  createToken,
  loginBlocked,
  recordLoginFailure,
  clearLoginFailures,
  clientAddress,
  failedLoginDelay,
  verifyAgainstNothing,
} from './auth.js'
import { isUuid, validateTournament, validateChanges } from './tournamentPayload.js'
import { subscribe, broadcast } from './events.js'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

// Don't advertise the framework, and add the standard protective headers to
// every response (what the helmet package would add, without the package).
app.disable('x-powered-by')
app.use((request, response, next) => {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
  // HTTPS only, once deployed (Cloudflare serves the site over HTTPS).
  if (isProduction) response.set('Strict-Transport-Security', 'max-age=15552000')
  next()
})

// CORS before the routes. Middleware registered after a route never sees that
// route's requests, which is the m4 lesson showing up in production.
//
// Name your origins. app.use(cors()) with no options sends
// Access-Control-Allow-Origin: *, which lets any site on the internet call this
// API from a visitor's browser, and is incompatible with cookies.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
// A whole bracket is sent in one request when a tournament is created, so
// this is larger than a typical form post.
app.use(express.json({ limit: '1mb' }))

// After a change, tell everyone watching (see events.js). The header is the
// id of the admin's browser tab, so that tab can skip its own echo.
function announce(request, event) {
  const origin = String(request.get('x-client-id') || '').slice(0, 64)
  broadcast({ ...event, origin })
}

// Is the process alive?
app.get('/healthz', (request, response) => {
  response.json({ ok: true })
})

// Is the database reachable? A different question, and the one that tells you
// in two seconds which half of a problem you have.
app.get('/readyz', async (request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true, db: 'up' })
  } catch (error) {
    console.error('readyz failed:', error.message)
    response.status(503).json({ ok: false, db: 'down' })
  }
})

// A malformed id would otherwise reach Postgres and come back as a 500.
function checkId(request, response, next) {
  if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Invalid id' })
  next()
}

// ---------------------------------------------------------------------------
// The REST API
// ---------------------------------------------------------------------------
//
//   POST   /api/sessions               log in: { username, password } -> { token }
//   GET    /api/events                 live updates (server-sent events)
//
//   GET    /api/tournaments            every tournament, with players and matches
//   POST   /api/tournaments            create one (a whole generated bracket)      admin
//   GET    /api/tournaments/:id        one tournament
//   PUT    /api/tournaments/:id        replace its bracket (before play starts)    admin
//   PATCH  /api/tournaments/:id        change part of it: scores, results, status  admin
//   DELETE /api/tournaments/:id        delete it                                   admin
//
//   GET    /api/players                every player
//   POST   /api/players                add a player: { name }                      admin
//   GET    /api/players/:id            one player
//   GET    /api/players/:id/stats      their wins and losses, per game
//   PATCH  /api/players/:id            rename: { name }                            admin
//   DELETE /api/players/:id            delete (only if in no tournament)           admin
//
// Answers: 200 OK, 201 Created (with a Location header), 204 No Content,
// 400 bad input, 401 not logged in, 404 not found, 409 conflict,
// 429 too many attempts.

// Every route handler goes through this, so a failed query reaches the error
// handler at the bottom instead of crashing the server.
const route = (handler) => (request, response, next) => Promise.resolve(handler(request, response)).catch(next)

// Log in. A "session" is created and handed back as a signed token.
app.post('/api/sessions', route(async (request, response) => {
  const address = clientAddress(request)
  const username = typeof request.body?.username === 'string' ? request.body.username.trim().slice(0, 50) : ''
  const password = typeof request.body?.password === 'string' ? request.body.password.slice(0, 200) : ''
  if (loginBlocked(address, username)) {
    return response.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' })
  }
  const admin = await admins.getByUsername(pool, username)
  const ok = admin ? await verifyPassword(password, admin.password_hash) : await verifyAgainstNothing(password)
  if (!ok) {
    recordLoginFailure(address, username)
    await failedLoginDelay()
    // Same message whether the username or the password was wrong.
    return response.status(401).json({ error: 'Incorrect username or password.' })
  }
  clearLoginFailures(address, username)
  response.status(201).json({ token: createToken(admin.username), username: admin.username })
}))

app.get('/api/events', (request, response) => {
  subscribe(request, response, clientAddress(request))
})

// --- Tournaments -----------------------------------------------------------

app.get('/api/tournaments', route(async (request, response) => {
  response.json(await tournamentService.list(pool))
}))

app.post('/api/tournaments', requireAdmin, route(async (request, response) => {
  const { errors, value } = validateTournament(request.body)
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })
  const created = await tournamentService.create(pool, value)
  announce(request, { type: 'tournament', id: created.id })
  response.status(201).location(`/api/tournaments/${created.id}`).json(created)
}))

app.get('/api/tournaments/:id', checkId, route(async (request, response) => {
  const tournament = await tournamentService.get(pool, request.params.id)
  if (!tournament) return response.status(404).json({ error: 'Not found' })
  response.json(tournament)
}))

app.put('/api/tournaments/:id', requireAdmin, checkId, route(async (request, response) => {
  const { errors, value } = validateTournament({ ...request.body, id: request.params.id })
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })
  const replaced = await tournamentService.replace(pool, request.params.id, value)
  announce(request, { type: 'tournament', id: request.params.id })
  response.json(replaced)
}))

// Body: { status, matches: [the matches that changed], rounds: [{ index, bestOf }] }
app.patch('/api/tournaments/:id', requireAdmin, checkId, route(async (request, response) => {
  const { errors, value } = validateChanges(request.body)
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })
  await tournamentService.update(pool, request.params.id, value)
  announce(request, { type: 'tournament', id: request.params.id })
  response.status(204).end()
}))

app.delete('/api/tournaments/:id', requireAdmin, checkId, route(async (request, response) => {
  const removed = await tournamentService.remove(pool, request.params.id)
  if (!removed) return response.status(404).json({ error: 'Not found' })
  announce(request, { type: 'tournament', id: request.params.id })
  response.status(204).end()
}))

// --- Players ---------------------------------------------------------------

app.get('/api/players', route(async (request, response) => {
  response.json(await players.getAll(pool))
}))

app.post('/api/players', requireAdmin, route(async (request, response) => {
  const name = typeof request.body?.name === 'string'
    ? request.body.name.trim()
    : ''

  if (!name || name.length > 100) {
    return response.status(400).json({
      error: 'name must be 1 to 100 characters',
    })
  }

  const player = await players.create(pool, {
    id: randomUUID(),
    name,
  })

  announce(request, { type: 'players' })
  response.status(201).location(`/api/players/${player.id}`).json(player)
}))

app.get('/api/players/:id', checkId, route(async (request, response) => {
  const player = await players.getById(pool, request.params.id)

  if (!player) {
    return response.status(404).json({ error: 'Not found' })
  }

  response.json(player)
}))

app.get('/api/players/:id/stats', checkId, route(async (request, response) => {
  if (!(await players.getById(pool, request.params.id))) {
    return response.status(404).json({ error: 'Not found' })
  }

  response.json(await players.getStats(pool, request.params.id))
}))

app.patch('/api/players/:id', requireAdmin, checkId, route(async (request, response) => {
  const name = typeof request.body?.name === 'string'
    ? request.body.name.trim()
    : ''

  if (!name || name.length > 100) {
    return response.status(400).json({
      error: 'name must be 1 to 100 characters',
    })
  }

  const player = await players.update(pool, request.params.id, { name })

  if (!player) {
    return response.status(404).json({ error: 'Not found' })
  }

  announce(request, { type: 'players' })
  response.json(player)
}))

app.delete('/api/players/:id', requireAdmin, checkId, route(async (request, response) => {
  const removed = await players.remove(pool, request.params.id)

  if (!removed) {
    return response.status(404).json({ error: 'Not found' })
  }

  announce(request, { type: 'players' })
  response.status(204).end()
}))

// ---------------------------------------------------------------------------
// Optional: serve the built website from this same server
// ---------------------------------------------------------------------------
// With SERVE_CLIENT=true the site (client/dist, after `npm run build` in
// client/) and the API share one address, so one Cloudflare Tunnel covers
// both and the browser never needs CORS. See docs/DEPLOY.md.
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url))
if (process.env.SERVE_CLIENT === 'true' && existsSync(clientDist)) {
  const pageSecurity = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  app.use((request, response, next) => {
    response.set('Content-Security-Policy', pageSecurity)
    next()
  })
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }))
  // Any other non-API path is a page of the single-page app.
  app.get(/^\/(?!api\/|healthz|readyz).*/, (request, response) => {
    response.sendFile('index.html', { root: clientDist })
  })
}

app.use((request, response) => {
  response.status(404).json({ error: 'No such route' })
})

// The detail goes in your logs; the visitor gets a plain message. Sending a
// stack trace to a stranger tells them about your file layout and dependencies.
app.use((error, request, response, next) => {
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: error.message })
  }
  // PostgreSQL error codes: 23505 = duplicate value, 23503 = still referenced.
  if (error.code === '23505') {
    return response.status(409).json({ error: 'That name is already taken by another player.' })
  }
  if (error.code === '23503') {
    return response.status(409).json({ error: 'This player is still in a tournament, so they cannot be deleted.' })
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'That request is too large.' })
  }
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'The request body is not valid JSON.' })
  }
  console.error(error)
  response.status(500).json({ error: 'Something went wrong on the server' })
})

// The host chooses the port and tells you through PORT. Hardcoding 3000 is the
// commonest reason a first deploy is marked unhealthy and killed.
const port = process.env.PORT || 3000
// HOST=127.0.0.1 accepts connections from this machine only, which is what
// you want behind a Cloudflare Tunnel (the tunnel connects locally). Unset,
// it listens on every network interface, as before.
const host = process.env.HOST || undefined

app.listen(port, host, () => {
  console.log(`API listening on http://localhost:${port}`)
  console.log(`CORS allows: ${allowedOrigins.join(', ')}`)
  if (!process.env.AUTH_SECRET) console.warn('AUTH_SECRET is not set: admin login and all write routes are disabled.')
})
