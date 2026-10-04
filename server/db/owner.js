// Setup scripts (migrations, creating admins, wiping data) need the database
// OWNER's login, which can change tables. The running app uses a restricted
// login (DATABASE_URL) that can't. When OWNER_DATABASE_URL is set, these
// scripts use it; otherwise they fall back to DATABASE_URL.
//
// Import this BEFORE pool.js (use `await import('./pool.js')` after it).
if (process.env.OWNER_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.OWNER_DATABASE_URL
}
