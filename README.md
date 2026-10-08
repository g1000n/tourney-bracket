# TourneyBracket

[![Made with AI](https://img.shields.io/badge/Made_with-AI_assistance-blue)](AI-USAGE.md)

Brackets, live scores and player stats for casual gaming tournaments. I built it
to host my own tournaments, and anyone else running a small LAN or online event
can use it or host their own copy.

**Live site:** https://tourney-bracket.onrender.com
**Health check:** https://tourney-bracket.onrender.com/readyz

The free Render instance sleeps when nobody has used it for a while, so the first
visit can take up to a minute to load.

![The tournaments dashboard](screenshots/tournaments.png)

## 1. Overview

TourneyBracket builds a fair bracket from a list of players in one of three
formats: single elimination, double elimination or round robin. It handles byes
for uneven player counts and lets the host score matches point by point, and
everyone watching sees the scores update live. Results are saved to PostgreSQL,
so every tournament and every player's record is kept across events. Anyone can
view; only the logged-in admin can create, score or change anything.

## 2. Setup and installation

**Requirements:** [Node.js](https://nodejs.org/) 20 or later (npm comes with it)
and a PostgreSQL database. The live site uses a free
[Supabase](https://supabase.com/) project; any PostgreSQL 15 or later also works.

**Get the code and install dependencies:**

```bash
git clone https://github.com/g1000n/tourney-bracket.git
cd tourney-bracket/server
npm install
cd ../client
npm install
```

**Create the `.env` files** from the examples (`.env` files are git-ignored; the
examples hold placeholders only):

```bash
cd server
cp .env.example .env
cd ../client
cp .env.example .env
```

**Server settings (`server/.env`):**

| Variable | Example | What it is |
|---|---|---|
| `DATABASE_URL` | `postgresql://tourney_app.<project-ref>:<password>@<host>:5432/postgres` | The login the running app uses: a restricted user that can only read and write the app's tables. Contains a password. |
| `OWNER_DATABASE_URL` | `postgresql://postgres.<project-ref>:<password>@<host>:5432/postgres` | The database owner's login. Used only by the setup scripts below, on your own computer; never set on the host. |
| `AUTH_SECRET` | 48 random characters (command below) | Signs admin login tokens. Without it, login and every change are switched off. |
| `NODE_ENV` | `development` | `production` on the host: no error details in responses, HTTPS-only headers. |
| `CORS_ORIGINS` | `http://localhost:5173` | Websites allowed to call the API. Needed locally, where the site and the API run on different ports. |
| `SERVE_CLIENT` | `false` | `true` on the host: the server also serves the built website, so both share one address. |
| `PORT` | (not set) | Set by the host. Defaults to 3000. |

Make an `AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Client settings (`client/.env`)**, read when the site is built:

| Variable | Example | What it is |
|---|---|---|
| `VITE_USE_MOCK_API` | `false` | `false` uses the real API. Unset or `true` runs demo mode (section 3). |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Where the API is, with no trailing slash. |

Every `VITE_` value ends up in the public JavaScript, so never put a password or
key in one.

**Create the Supabase project** (free; skip this if you use your own PostgreSQL):

1. Sign up at [supabase.com](https://supabase.com/) and click **New project**.
   Give it a name, set a **database password** (save it somewhere safe, you'll
   need it next) and pick the region closest to you.
2. When the project is ready, click **Connect** at the top of its dashboard,
   open the **Session pooler** connection string, and copy the URI. It looks like
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`.
3. Replace `[YOUR-PASSWORD]` with the password from step 1. This is the owner
   connection string used below. Use the session pooler rather than the direct
   connection: it also works from hosts such as Render that can't reach
   Supabase's direct address.

**Set up the database** (in `server/`, in this order):

1. Put the owner connection string in `DATABASE_URL`.
2. Create the tables and add two sample tournaments with invented players:
   ```bash
   npm run db:reset
   ```
   This **empties every table first**, so only run it on a new database.
3. Create the restricted `tourney_app` login. This moves the owner login to
   `OWNER_DATABASE_URL` and puts the restricted one in `DATABASE_URL`:
   ```bash
   npm run db:app-role -- --write-env
   ```
4. On Supabase, close its public table API, which this app doesn't use:
   ```bash
   npm run db:lock
   ```
5. Create your admin account. It asks for a password without showing it, and
   stores only a hash:
   ```bash
   npm run admin:create -- yourname
   ```

These scripts run on your own computer, against the database named in your own
`.env`, and they need the owner's password. The website has no route that runs
them, so nobody visiting the site can reset the data or create an admin.

To upgrade a database made with an older version of this app, run
`npm run db:migrate` (safe to run more than once).

## 3. How to run it

Two terminals:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Open http://localhost:5173. You should see the Tournaments page with the sample
tournaments. The admin login isn't linked from the site: go to
http://localhost:5173/admin/login and log in with your admin account to get the
create, score and delete controls.

**For grading:** an admin account for the instructor exists on the live site; its
login details are in my private workspace `project/README.md`. Log in at
https://tourney-bracket.onrender.com/admin/login.

**Check the API on its own:**

```bash
curl http://localhost:3000/healthz
```

```bash
curl http://localhost:3000/readyz
```

```bash
curl http://localhost:3000/api/tournaments
```

`/healthz` answers `{"ok":true}` when the server is running, `/readyz` answers
`{"ok":true,"db":"up"}` when it can reach the database, and `/api/tournaments`
returns every tournament as JSON.

**Demo mode.** With `VITE_USE_MOCK_API` unset or `true`, the client runs with no
server: it keeps everything in the browser's `localStorage`, shows a "Demo mode"
label, and accepts the login `admin` / `123`. It's for showing the interface
without a database.

**Tests:**

```bash
cd client
npm run check:brackets
```

This plays thousands of random tournaments in all three formats and checks the
bracket rules: byes, loss counts, everyone meeting once in round robin, podiums
and reopening results.

## 4. Features and usage

**Viewing (anyone):**
- The Tournaments page lists every tournament, in progress first.
- A bracket page shows every round. Matches being played have a **Live** tag and
  their scores update on their own, without reloading.
- The Stats page groups tournaments by game, with a leaderboard per game, and
  lists every player's wins, losses and match history. The search box filters all
  of it.

**Hosting (admin):**

Sign in at `/admin/login` (for example http://localhost:5173/admin/login or
https://tourney-bracket.onrender.com/admin/login) with the account you made with
`npm run admin:create`; in demo mode the login is `admin` / `123`. Once signed
in, the header shows **New tournament** and **Log out**, and every bracket shows
the scoring controls. A login lasts 12 hours.

1. **New tournament:** pick or type the game, name the event, choose the format
   and match length (best of 1, 3, 5, 7, or free score, with a separate length
   for the semifinals onward), and add players from the dropdown or by typing.
   Seeding is random by default; untick it to enter seeds, which are pre-filled
   from the last tournament of the same game.
2. **Generate bracket.** Byes go to the top seeds when the player count is uneven.
   Single elimination can add a 3rd-place match; double elimination has a losers
   bracket, a grand final and a reset if needed.
3. **Score:** use − / + on a match card. Every point is saved and shown live.
   **Finish** locks the result and advances the winner. **Edit result** reopens a
   finished match and takes its winner back out of the next round, but only while
   that next match hasn't started; once it has a score, reopen the later match first.
4. **Manage:** rename or remove a player, change a round's match length before it
   starts, or delete the tournament.

**API.** A REST API: each URL is a resource (tournaments, players, sessions), the
HTTP method says what to do with it, and requests and responses are JSON. Routes
marked admin need `Authorization: Bearer <token>` from `POST /api/sessions`.
Success answers 200, 201 (with a `Location` header) or 204; errors come back as
`{ "error": "..." }` with 400, 401, 404, 409 or 429.

| Method | Path | Admin | What it does |
|---|---|---|---|
| POST | `/api/sessions` | – | Log in with `{ username, password }` and get a 12-hour token |
| GET | `/api/events` | – | Live updates (server-sent events) |
| GET | `/api/tournaments` | – | Every tournament with its players and matches |
| POST | `/api/tournaments` | yes | Save a new bracket (201 with a `Location`) |
| GET | `/api/tournaments/:id` | – | One tournament |
| PUT | `/api/tournaments/:id` | yes | Replace a bracket that hasn't started (409 once it has) |
| PATCH | `/api/tournaments/:id` | yes | Save changed matches, round lengths or status |
| DELETE | `/api/tournaments/:id` | yes | Delete a tournament (204) |
| GET | `/api/players` | – | Every player |
| POST | `/api/players` | yes | Add a player `{ name }` |
| GET | `/api/players/:id` | – | One player |
| GET | `/api/players/:id/stats` | – | A player's wins and losses per game |
| PATCH | `/api/players/:id` | yes | Rename a player `{ name }` |
| DELETE | `/api/players/:id` | yes | Delete a player (409 if they are still in a tournament) |
| GET | `/healthz`, `/readyz` | – | Is the server up, is the database reachable |

## 5. Project structure

```
client/                 React front end, built by Vite
  src/api/              one interface, two versions: httpApi.js (real API), mockApi.js (demo mode)
  src/context/          TournamentsContext: app state, saving, live updates
  src/lib/              bracket logic: bracket.js (entry point), bracketCore.js,
                        singleElimination.js, doubleElimination.js, roundRobin.js
  src/pages/            Tournaments, Setup, Bracket view (with live scoring), Stats, Admin login
  src/components/       Header, Footer, TournamentCard, Combobox, BackLink
  scripts/              check-brackets.mjs (tests), build-for-server.mjs
server/                 Express API
  server.js             routes, security headers, login limiter
  tournamentService.js  saves and loads whole brackets in transactions
  *Repo.js              one file per table, one parameterised query per function
  auth.js               password hashing and login tokens
  events.js             live updates
  db/                   schema.sql, seed.sql, migrations/, setup scripts
docs/                   planning documents from the course template
screenshots/            images used in this README
```

## 6. Screenshots

| | |
|---|---|
| ![Tournaments page, public view](screenshots/tournaments.png) | ![Tournaments page, admin view](screenshots/tournaments-admin.png) |
| Tournaments, as a visitor sees them | Tournaments, with the admin's Delete buttons |
| ![Creating a tournament](screenshots/new-tournament.png) | ![A double-elimination bracket](screenshots/bracket.png) |
| New tournament: format, match length, seeding, players | A double-elimination bracket with live scoring (admin view) |
| ![Stats page](screenshots/stats.png) | ![Admin login](screenshots/admin-login.png) |
| Stats: games and every player's record | Admin login |

A bracket on a phone, as a visitor sees it:

<img src="screenshots/bracket-phone.png" alt="A bracket on a phone" width="260">

## 7. Architecture

```
Browser (React) ──HTTPS──▶ Express on Render ──SQL──▶ PostgreSQL on Supabase
       ▲                         │
       └──── live updates (SSE) ─┘
```

One Render web service runs the Express API and also serves the built React
site, so both are on one address and no CORS setup is needed. The bracket rules
run in the browser; after every action the client sends only the matches that
changed, and the server validates them and saves them in a transaction. Every
change is announced on `/api/events`, and every open page reloads the data. The
app connects to Supabase as a restricted login that can only read and write its
own tables.

**Deploying on Render:** one Web Service from this repository with Root Directory
`server`, Language Node, Build Command
`npm ci && cd ../client && npm ci --include=dev && npm run build:server`, Start
Command `node server.js` and Health Check Path `/readyz`. Its environment
variables are `DATABASE_URL` (the restricted `tourney_app` login), a new
`AUTH_SECRET`, `NODE_ENV=production` and `SERVE_CLIENT=true`. Add `server/**` and
`client/**` as Build Filters so a change to either folder redeploys.

## 8. Known issues and future improvements

**Known issues:**
- In double elimination with 16 or more players, two players can sometimes meet
  twice before the losers semifinal. With this bracket shape it can't be avoided
  completely; it's documented in `doubleElimination.js`.
- A player can't be removed once their tournament has started.
- If two admins score the same match at the same moment, the last save wins.
- Failed-login counts are kept in the server's memory, so a restart (a redeploy,
  or the free instance waking up) clears them and gives a guesser a fresh set of
  attempts. The delay on every wrong password and the password hashing still apply.
- Saving a new tournament takes 2–3 seconds against Supabase.
- The free Render instance sleeps, so the first visit after a quiet period is slow.

**Future improvements:**
- Forfeits and withdrawals, so a player can leave a tournament that has started.
- Stop two admins from overwriting each other's scores on the same match.
- Keep the failed-login counts in the database, so restarts don't reset them.
- Swiss format, and a printable or shareable bracket image.

## Author

[g1000n](https://github.com/g1000n). 6APSI final project.

## AI use

Built with Claude: the Claude chat app in week 1, then Claude Code
(Claude Opus 5.5) from 2026-10-01. AI wrote most of the code. I wrote the
players, admins and entries data layer, the live-update stream, the players API
routes and my tournaments repository functions. The full account, including
where the AI got it wrong, is in [AI-USAGE.md](AI-USAGE.md).

## Licence

MIT, see [LICENSE](LICENSE).
