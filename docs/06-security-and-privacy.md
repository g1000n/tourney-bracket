# Security and privacy checklist

Worked through before making the project public and again before submitting.
The full version, with evidence for every row, is
[`SECURITY-CHECKLIST.md`](../SECURITY-CHECKLIST.md).

## Before the first push

- [x] `.gitignore` includes `.env`, and `git check-ignore -v .env` confirms it
- [x] `git ls-files | grep -iE '\.env$|\.pem$|id_rsa'` prints nothing
- [x] `.env.example` is committed, with placeholder values only (`server/` and `client/`)
- [x] No connection string, key or password anywhere in the repository, including screenshots
- [x] No `student.json`, and no name, student number or email in any file. Commit history uses only my GitHub noreply address (rewritten on 2026-10-07).

## The application

- [x] Every SQL query is parameterised: one query per repo function, values in the array
- [x] Input is validated on the server (`server/tournamentPayload.js`, the player name checks), with length limits on every text field
- [x] CORS names its origins (`CORS_ORIGINS`), never `cors()` with no options. The deployed site and API share one address, so it isn't needed there.
- [x] `NODE_ENV=production` on the host, and no stack trace in any response body
- [x] Security headers: set by hand in `server.js` instead of `helmet` (nosniff, frame denial, referrer policy, HSTS in production, a strict Content Security Policy when serving the site)
- [x] The login is rate limited: 5 failures per address and 10 per username, then a 15-minute lock
- [x] Passwords are hashed with scrypt (Node's built-in, in place of bcrypt) and never logged
- [x] Ownership checks: N/A. There is one admin and no per-user data; every changing route requires the admin login.
- [x] `npm audit`: 0 vulnerabilities in `server/` and `client/`

## Privacy

- [x] No real classmates' numbers, emails or photos in any file or seed data
- [ ] Check before submitting: player names in the screenshots, the live database and the video are invented, or used with that person's OK
- [x] Seed data is invented
- [x] The app collects only player display names typed by the admin; no accounts for players
- [x] No faces in any screenshot

## The riskiest thing

The riskiest thing was the database login. The app first connected to Supabase
as the owner, which can drop or empty every table, and Supabase's public API
still had its default permissions. I changed the app to a restricted login that
can only read and write its own tables, and closed the public API. The checklist also
caught personal email addresses in the commit history, which I removed by
rewriting it. What I knowingly accepted: viewing is public and only one admin
account exists, so there is no per-user access control.
