// Admin login. Built on node:crypto only, so there are no extra packages.
//
// Passwords: stored in admins.password_hash as "scrypt$<salt>$<hash>", never
//            as plain text. scrypt is deliberately slow, which makes guessing
//            passwords from a stolen database expensive.
// Tokens:    after a successful login the server hands back a signed token
//            ("<payload>.<signature>"). The browser sends it with every
//            create/edit/delete request. Nobody can forge one without
//            AUTH_SECRET, which lives only in the server's environment.

import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto'
import { promisify } from 'node:util'
import { pool } from './db/pool.js'
import * as admins from './adminsRepo.js'

const scryptAsync = promisify(scrypt)
const TOKEN_HOURS = 12

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptAsync(password, salt, 64)
  return `scrypt$${salt}$${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hashHex] = String(stored).split('$')
  if (scheme !== 'scrypt' || !salt || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, salt, expected.length)
  return timingSafeEqual(actual, expected)
}

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) return null
  return value
}

const sign = (payload, key) => createHmac('sha256', key).update(payload).digest('base64url')

export function createToken(username) {
  const key = secret()
  if (!key) throw new Error('AUTH_SECRET is not set (or shorter than 32 characters).')
  const payload = Buffer.from(
    JSON.stringify({ sub: username, exp: Date.now() + TOKEN_HOURS * 3600_000 })
  ).toString('base64url')
  return `${payload}.${sign(payload, key)}`
}

export function readToken(token) {
  const key = secret()
  if (!key || typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload, key))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.exp > Date.now() ? data : null
  } catch {
    return null
  }
}

// Put this in front of every route that changes data. Besides checking the
// token, it checks the admin account still exists, so deleting an admin
// locks them out immediately rather than when their token expires.
export async function requireAdmin(request, response, next) {
  if (!secret()) {
    console.error('AUTH_SECRET is not set, so admin routes are disabled.')
    return response.status(503).json({ error: 'Admin login is not configured on the server.' })
  }
  const header = request.get('authorization') || ''
  const session = readToken(header.startsWith('Bearer ') ? header.slice(7) : '')
  if (!session) return response.status(401).json({ error: 'Admin login required.' })
  try {
    if (!(await admins.getByUsername(pool, session.sub))) return response.status(401).json({ error: 'Admin login required.' })
  } catch (error) {
    return next(error)
  }
  request.admin = session.sub
  next()
}

// The visitor's address. Behind Cloudflare (a tunnel or proxy) every request
// reaches the server from Cloudflare, so the real address comes from the
// CF-Connecting-IP header. Only trust that header when TRUST_CLOUDFLARE=true,
// i.e. when the server is reachable ONLY through Cloudflare; otherwise
// anyone could send a fake header to dodge the limits below.
export function clientAddress(request) {
  if (process.env.TRUST_CLOUDFLARE === 'true') {
    const forwarded = request.get('cf-connecting-ip')
    if (forwarded) return forwarded.trim().slice(0, 64)
  }
  return request.ip || 'unknown'
}

// Brakes on password guessing, kept in memory (they reset when the server
// restarts, which is fine for one small server):
//   - one address: 5 failed logins, then locked out for 15 minutes;
//   - one username: 10 failed logins from anywhere, then that username is
//     locked for 15 minutes, so spreading guesses over many addresses
//     doesn't help.
// Every failed attempt is also answered only after a short delay.
const WINDOW_MS = 15 * 60_000
const LIMITS = { address: 5, username: 10 }
const failures = { address: new Map(), username: new Map() }

function recent(map, key) {
  const entry = map.get(key)
  if (entry && Date.now() - entry.first > WINDOW_MS) {
    map.delete(key)
    return null
  }
  return entry
}

export function loginBlocked(address, username) {
  const byAddress = recent(failures.address, address)
  const byUsername = recent(failures.username, username.toLowerCase())
  return (byAddress?.count ?? 0) >= LIMITS.address || (byUsername?.count ?? 0) >= LIMITS.username
}

export function recordLoginFailure(address, username) {
  for (const [map, key] of [
    [failures.address, address],
    [failures.username, username.toLowerCase()],
  ]) {
    const entry = recent(map, key)
    if (entry) entry.count++
    else map.set(key, { count: 1, first: Date.now() })
  }
}

export function clearLoginFailures(address, username) {
  failures.address.delete(address)
  failures.username.delete(username.toLowerCase())
}

// Forget old entries every few minutes so the maps can't grow forever.
setInterval(() => {
  for (const map of Object.values(failures)) {
    for (const key of map.keys()) recent(map, key)
  }
}, 5 * 60_000).unref()

export const failedLoginDelay = () => new Promise((resolve) => setTimeout(resolve, 600))

// Checked when the username doesn't exist, so a wrong username takes as long
// as a wrong password and response times don't reveal which usernames exist.
let dummyHash = null
export async function verifyAgainstNothing(password) {
  dummyHash ??= await hashPassword('not-a-real-password')
  await verifyPassword(password, dummyHash)
  return false
}
