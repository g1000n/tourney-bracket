# Security checklist — TourneyBracket

Checked 2026-10-02 against the working tree on `main` and the live Supabase
database, and updated 2026-10-08 after deploying on Render.

## Secrets and credentials

| # | Check | Yes / No / N/A | Evidence |
|---|---|---|---|
| 1 | .env is gitignored and is not in the repository | Yes | `.gitignore` has `.env` and `.env.*` (with `!.env.example`). `git log --all -- server/.env client/.env .env` returns nothing, so no .env was ever committed. `git check-ignore` confirms `server/.env`, `client/.env` and the `.env.backup-*` file are ignored. |
| 2 | A .env.example with placeholder values only is committed | Yes | `server/.env.example` and `client/.env.example` hold only placeholders: a local `devpassword` example URL, empty `AUTH_SECRET` and `OWNER_DATABASE_URL`, and no real host. |
| 3 | No connection string, key, token or password is hardcoded in source, comments or commented-out code | Yes | Grepped every file that would be committed for connection strings, keys, JWTs, `service_role` and long secrets: no matches. The prototype's hardcoded admin login (`admin`/`123` in AdminLoginPage.jsx) was removed; login now checks a hashed password on the server. Untracked `client-code-dump.txt` still contains that old code: delete it, don't commit it. |
| 4 | Git history is clean: I searched git log -p for password, secret, api key and postgres:// | Yes | `git log --all -p` searched for password, secret, api key and postgres://. The only hits are form labels, template docs, and the removed `admin`/`123` prototype check. No connection string or key appears in any commit. |
| 5 | Any credential that was ever committed has been rotated | N/A | No real credential was ever committed. The `admin`/`123` prototype only existed in browser code and never protected anything on a server. The real admin accounts are scrypt-hashed in the database. |
| 6 | Production credentials live only in my hosting provider's environment settings | Yes | Deployed on Render on 2026-10-08. `DATABASE_URL` (the restricted `tourney_app` login), a new `AUTH_SECRET`, `NODE_ENV` and `SERVE_CLIENT` are set only in Render's Environment settings, typed in one by one (not uploaded from `.env`). `OWNER_DATABASE_URL` is not on the server. Locally they stay in git-ignored `server/.env`. |

## GitHub Actions

| # | Check | Yes / No / N/A | Evidence |
|---|---|---|---|
| 7 | No secret value is written literally in any workflow YAML file | Yes | `.github/workflows/deploy-pages.yml` contains no secret values. It reads two repository *variables*, `VITE_USE_MOCK_API` and `VITE_API_BASE_URL`, which are public by design (they end up in the built JavaScript). |
| 8 | Secrets are stored in repository Actions secrets and read with ${{ secrets.NAME }} | N/A | The workflow needs no secrets. The only token used is GitHub's automatic OIDC token for Pages, which GitHub masks. |
| 9 | No workflow step echoes, dumps or debug-prints a secret, and I opened a recent run's log to confirm | Yes | Opened run 36833027370 (2026-10-01) with `gh run view --log`. The only token in it is `"oidc_token": "***"` (masked); the `echo` steps print status text only. (Those runs failed because GitHub Pages isn't switched on; the workflow now runs only when started by hand.) |
| 10 | Uploaded build artifacts contain no .env, key file or generated config | Yes | The artifact is `client/dist` only: index.html, favicon.svg, one JS, one CSS and the logo SVG. Checked with `find client/dist`: no `.env`, `.pem` or `.key`. Only public `VITE_` values are built in. |
| 11 | Third-party actions are pinned to a commit SHA, not a moveable tag | Yes | All four actions are pinned to full commit SHAs, looked up with `git ls-remote`: checkout `11d5960…`, setup-node `49933ea…`, upload-pages-artifact `56afc60…`, deploy-pages `d6db901…`. The tag is kept as a comment. |
| 12 | Secret scanning and push protection are enabled on the repository | Yes | `gh api repos/g1000n/tourney-bracket` reports `secret_scanning: enabled` and `secret_scanning_push_protection: enabled`. |

## Database

| # | Check | Yes / No / N/A | Evidence |
|---|---|---|---|
| 13 | Every query taking user input uses parameters, never string concatenation | Yes | All queries live in the repo files (`tournamentsRepo.js`, `playersRepo.js`, `entriesRepo.js`, `matchesRepo.js`, `adminsRepo.js`), one parameterised query per function with `$1…` placeholders. Lists of rows go as one JSON parameter through `jsonb_to_recordset`. The only assembled SQL is in the setup script `db/create-app-role.js`, with fixed table and role names and `format(%I, %L)` for the generated password, never user input. |
| 14 | The database is not open to the whole internet, or is reachable only by the app | No | Supabase's public Data API is closed: `db:lock` revoked all anon/authenticated grants, and a test as the `anon` role was refused on all 5 tables, 15 out of 15 attempts. But the Postgres endpoint itself is still reachable from the internet with a password (Supabase's default). Render's free tier has no fixed outgoing IP address, so Supabase's Network Restrictions can't be limited to the server without blocking the app. Accepted risk: the app's login is the restricted `tourney_app` role with a long generated password, and the owner password is never on the server. |
| 15 | The database user the app connects as has only the permissions it needs | Yes | The app connects as `tourney_app`: SELECT/INSERT/UPDATE/DELETE on tournaments, players, tournament_players and matches, and SELECT only on admins, enforced by grants plus RLS policies. Tested: it is refused TRUNCATE. The owner login is used only by setup scripts, through `OWNER_DATABASE_URL`. |
| 16 | Seed and sample data is invented, not real people's data | Yes | `server/db/seed.sql` uses invented first names (Alex, Blake, Casey, Drew…) and invented tournaments. |
| 17 | Debug, seed and reset routes are removed before going public | Yes | The server's only routes are `/healthz`, `/readyz`, login, `/api/events`, tournaments and players. No debug, seed or reset route exists. Seeding and wiping are local npm scripts that need the owner login (`db:wipe` also asks you to type DELETE EVERYTHING). |

## Access control

| # | Check | Yes / No / N/A | Evidence |
|---|---|---|---|
| 18 | The app has an access layer: Cloudflare Zero Trust, an app-level password, or a real login | Yes | A real login (`server/auth.js`). Passwords are scrypt-hashed in `admins`. Logins issue a signed 12-hour token, and `requireAdmin` guards every route that changes data. Reading brackets is public on purpose. |
| 19 | If Supabase or Firebase: Row Level Security or security rules are on, and I tested it signed out | Yes | RLS is on for all 5 tables (`pg_class.relrowsecurity` = true). Signed-out test: as Supabase's `anon` role, read, TRUNCATE and DELETE were refused on every table ("permission denied"). |
| 20 | If Zero Trust: tjakoen.s@gmail.com is on the access policy. If an app password: the credentials are in my private workspace project/README.md | Yes | The app uses a real login, not Zero Trust or a shared app password. I made a separate admin account for the instructor (`npm run admin:create -- instructor`, 2026-10-08); its username and password are in my private workspace `project/README.md`, not in this repository. |
| 21 | The gate covers every route, including the ones that only change data | Yes | `requireAdmin` is on every POST/PUT/PATCH/DELETE route: `/api/tournaments`, `/api/tournaments/:id`, `/api/players` and `/api/players/:id`. Tested: creating a tournament or renaming a player without logging in returns 401, locally and on the live site (2026-10-08: POST /api/tournaments and DELETE /api/players/:id both 401). A deleted admin's token is refused at once. |
| 22 | The credentials for the gate are environment variables, not in source | Yes | `AUTH_SECRET` comes from the environment. Admin passwords are set with `npm run admin:create` (hidden prompt) and stored only as hashes. No credential is in the source. |

## Input and output

| # | Check | Yes / No / N/A | Evidence |
|---|---|---|---|
| 23 | Input from the user is validated on the server, not only in the browser | Yes | `server/tournamentPayload.js` checks every tournament and match change (ids, names, scores, links, formats). The player rename and login inputs are length-checked in `server.js`. Tested: an invalid tournament returns 400 with the reason. |
| 24 | User-supplied text is escaped when rendered, so it cannot inject markup or script | Yes | React escapes all rendered text. Grep found no `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `client/src`. When the server serves the site, a Content-Security-Policy with `script-src 'self'` is also sent. |
| 25 | Error responses do not expose stack traces, file paths or connection details | Yes | The error handler returns fixed messages and only logs the details on the server. Malformed JSON returns a plain 400 (tested on the live site: "The request body is not valid JSON.", no stack trace). Production runs with `NODE_ENV=production`. |
| 26 | CORS is not a wildcard on routes that change data | Yes | `cors({ origin: allowedOrigins })` with named origins from `CORS_ORIGINS`, never `*`. When the server also serves the site, browsers call it from the same origin and no CORS is needed. |

## Repository and privacy

| # | Check | Yes / No / N/A | Evidence |
|---|---|---|---|
| 27 | No student number, personal email, phone number or home address in the repository or in commit messages | Yes | Scanned every file for emails, phone numbers and student numbers: no matches. On 2026-10-07 I rewrote the commit history so every commit's author and committer is `169319437+g1000n@users.noreply.github.com` (checked with `git log --format="%an <%ae> %cn <%ce>"`: one identity, 12 commits), and new commits use it too (`git config user.email`, this repo only). Also tick "Keep my email address private" at github.com/settings/emails. |
| 28 | No classmate's personal data in the repository | Yes | No classmate data in any file, seed data or screenshot, and none in the commit history: every commit's author and committer is my own noreply address (checked with `git log --format="%an <%ae> %cn <%ce>"`). |
| 29 | Dependencies come from official registries, and node_modules is gitignored | Yes | Both lockfiles resolve every package from `registry.npmjs.org`, and `node_modules/` is in `.gitignore`. A stray untracked root `package.json`/`package-lock.json` (installing `@supabase/server`, unused) should be deleted, not committed. |
| 30 | Images, fonts and other assets are mine, licensed, or credited | Yes | The logo and wordmark are my own (my Figma file). Gloock and Nunito are loaded from Google Fonts under the SIL Open Font License. The screenshots are of my own app. The style reference images (Jay Jay, Webby Nook) are not in the repository. |
| 31 | Repository visibility is deliberate, and I checked it after my last push | Yes | Public on purpose: the course requires a public project repository. Checked on 2026-10-08 after pushing (`gh api repos/g1000n/tourney-bracket` reports `visibility: public`). || 6 | Production credentials live only in my hosting provider's environment settings | Yes | Deployed on Render on 2026-10-08. `DATABASE_URL` (the restricted `tourney_app` login), a new `AUTH_SECRET`, `NODE_ENV` and `SERVE_CLIENT` are set only in Render's Environment settings, typed in one by one (not uploaded from `.env`). `OWNER_DATABASE_URL` is not on the server. Locally they stay in git-ignored `server/.env`. |# Security checklist — TourneyBracket

## Anything I found and fixed

The checklist showed the app was connecting to Supabase as the all-powerful
owner, and that Supabase's public API still had default permissions, including
TRUNCATE, which Row Level Security doesn't block. The app now runs as a
restricted `tourney_app` login, and the public API is closed. Both were tested.
It also caught unpinned GitHub Actions (now pinned to commit SHAs) and personal
emails in the commit history, which I removed by rewriting it on 2026-10-07. The login now
locks out repeated guessing, by address and by username.
