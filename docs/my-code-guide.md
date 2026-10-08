# Guide: the server pieces you're writing yourself

> **Status:** I wrote steps 1 to 4 (commit `c952329`, plus the players routes in `server.js`). I chose not to write step 5, `matchesRepo.js`, so it stays AI-written. Kept as a record of the spec I worked from.

This is a spec, not code. It says what each file must do, why it exists and
who uses it, so you can write it yourself and explain it afterwards.

Use your own `tournamentsRepo.js` and `playersRepo.js` as your pattern:
- each function takes `pool` first;
- runs one query, with `$1, $2…` placeholders (never glue values into the SQL);
- and returns `result.rows`, `result.rows[0] ?? null`, or `result.rowCount > 0`.

**Work one file at a time.** Other files import these, so while one is missing
the server won't start: delete it, write yours, test it, then move on.

**Testing:** after each file, ask Claude to "run the API test". The same
50 checks the app passes now are run against your version, and you're told
exactly what fails.

## Suggested order (easiest first)

| # | Piece | Difficulty | About | Why it's a good one to own |
|---|---|---|---|---|
| 1 | `adminsRepo.js` | Easy | 2 functions | The same shape as `tournamentsRepo.js` |
| 2 | `entriesRepo.js` | Easy, with one new idea | 4 functions | Teaches the "save a list in one query" trick |
| 3 | The players routes in `server.js` | Medium | 6 routes | Connects your `playersRepo` to the web |
| 4 | `events.js` | Medium | 2 functions | Live updates; a nice thing to explain in a demo |
| 5 | `matchesRepo.js` | Harder (longest) | 8 functions | Core of the app; pushes you past one fifth |

`db/wipe.js` is actually shorter and simpler than `matchesRepo.js`, but
`matchesRepo.js` is fine instead if you prefer it. It's longer, mostly
because the column lists are long.

Rough count: your two repos (73 lines) + 1–4 (about 135) is about **15%** of the server.
Adding `matchesRepo.js` (about 80) brings it to about **21%**.

---

## 1. `adminsRepo.js`: admin accounts

**Why it exists.** Every query on a table lives in that table's repo file.
This one is for the `admins` table (`id`, `username`, `password_hash`,
`created_at`). Passwords are never stored, only a hash made by `auth.js`.

**Who uses it**
- `server.js`: the login route.
- `auth.js`: checks the admin still exists on every admin request.
- `db/create-admin.js`: the command that creates your account.

All three already call these exact names, so keep them.

### `getByUsername(pool, username)`
- **Returns:** the admin row whose `username` matches, or `null` if there isn't one.
- **The row must include `username` and `password_hash`.** `SELECT *` is fine.
- **The same shape as your `getById`**, just a different column.

### `save(pool, admin)`
- **`admin` is** `{ username, password_hash }`.
- **What it does:** creates the admin. If that username already exists, it changes their `password_hash` instead. That's how re-running `npm run admin:create` resets a password.
- **Returns:** the saved row's `id` and `username`. Never return the hash.
- **Hint:** an `INSERT` with `ON CONFLICT (username) DO UPDATE SET password_hash = …` does "insert, or update if it exists" in one query. `username` is UNIQUE, which is what makes the conflict possible. Inside `DO UPDATE`, `EXCLUDED.password_hash` means "the value I just tried to insert". Add `RETURNING id, username`.

**How to explain it:** "It's the only place that touches the admins table:
one function looks an admin up for logging in, and one saves an admin when I
run the create-admin command."

---

## 2. `entriesRepo.js`: who is in which tournament

**Why it exists.** The `tournament_players` table joins players to
tournaments. Each row is one entry: `tournament_id`, `player_id`, `rank` (the
seed the admin typed) and `seed` (the seed they actually got). A player can be
in many tournaments, and a tournament has many players.

**Who uses it:** `tournamentService.js`, when loading, creating or rebuilding
a tournament.

### `getAll(pool)`
- **Returns:** every entry, for every tournament.
- **Each row needs:** `tournament_id`, `player_id`, `rank`, `seed` **and the player's `name`**.
- **Hint:** `name` lives in the `players` table, so `JOIN players` on `players.id = tournament_players.player_id`. Short aliases (`tp`, `p`) keep it readable.
- **No `ORDER BY` needed.** The service sorts them.

### `getByTournament(pool, tournamentId)`
- **The same as `getAll`,** but only one tournament's entries (`WHERE tournament_id = $1`).

### `createMany(pool, tournamentId, entries)`
- **`entries` is a list** like `[{ player_id, rank, seed }, …]`, all for one tournament.
- **What it does:** inserts one `tournament_players` row per item. It returns nothing.
- **The one new idea: saving a list in ONE query.** You *could* loop and run one `INSERT` per entry. It works, but every query is a trip to Supabase (about a quarter of a second each), so a 16-player tournament gets slow. Instead:
  1. Send the whole list as **one** JSON parameter: `JSON.stringify(entries)`.
  2. Let Postgres turn the JSON back into rows with `jsonb_to_recordset`.

  A made-up example, on a `pets` table that isn't in this app:

  ```sql
  INSERT INTO pets (owner_id, name, age)
  SELECT $1, x.name, x.age
  FROM jsonb_to_recordset($2::jsonb) AS x(name text, age int)
  ```

  Called with `[ownerId, JSON.stringify([{ name: 'Rex', age: 3 }, { name: 'Tom', age: 5 }])]`, this inserts two pets in one trip. The `AS x(name text, age int)` part tells Postgres which keys to read from each JSON object, and their types. Your version needs the keys `player_id uuid, rank int, seed int`.

  If this feels like too much, the loop version is acceptable. It's slower but correct, so say that's why you chose it.

### `removeByTournament(pool, tournamentId)`
- **What it does:** deletes every entry of one tournament. It returns nothing.
- **Used when a bracket is rebuilt** (a player removed before play starts): old entries out, new entries in.

**How to explain it:** "A tournament's player list is its own table, so this
file reads it, with names, for loading, and writes it when a tournament is
created or rebuilt. `createMany` sends the whole list in one query so saving is
fast."

---

## 3. The players routes in `server.js`

**What to delete.** Remove the six `app.…('/api/players…')` blocks (under
`// --- Players ---`) and the small `playerName` helper function. Keep
everything else, especially these helpers you'll use:

| Helper | What it does |
|---|---|
| `route(async (request, response) => { … })` | Wraps a handler so a failed query goes to the error handler instead of crashing the server |
| `requireAdmin` | Put it before the handler on routes that change data. Without a valid login it answers 401 by itself. |
| `checkId` | Put it on routes with `:id`. A malformed id gets a 400 before your code runs. |
| `announce(request, { type: 'players' })` | Call it after a successful change, so viewers' screens refresh (live updates) |
| `randomUUID()` | Already imported; makes a new id |

**Why these routes exist.** They're the REST API for players: the web
address of each action, and the HTTP verb that says what kind of action it is.

| Method and path | Admin? | What it does | Answers |
|---|---|---|---|
| `GET /api/players` | no | `players.getAll(pool)` → send the list | 200 + JSON |
| `POST /api/players` | yes | Body `{ name }`, which must be text, trimmed, 1–100 characters (else 400 `{ error }`). `players.create(pool, { id: randomUUID(), name })` → announce. | 201 + `Location: /api/players/<id>` + the player |
| `GET /api/players/:id` | no | `players.getById` → 404 `{ error: 'Not found' }` if null | 200 + the player |
| `GET /api/players/:id/stats` | no | 404 if the player doesn't exist, else `players.getStats` | 200 + the list |
| `PATCH /api/players/:id` | yes | Body `{ name }`, validated as above. `players.update(pool, id, { name })` → 404 if null → announce. | 200 + the player |
| `DELETE /api/players/:id` | yes | `players.remove` → 404 if false → announce | 204, no body (`response.status(204).end()`) |

**Notes**
- **Validate input on the server, even though the website also checks it.** People can call the API without the website. That's checklist row 23.
- **Duplicate names and deleting players who are still in a tournament are already handled.** Postgres refuses those, and the error handler at the bottom of `server.js` turns its error codes (23505, 23503) into friendly 409 answers.
- **Copy the style of the tournament routes just above yours.** They use the same helpers.

**How to explain it:** "Each route is one action on the player resource: the
verb says what (GET reads, POST creates, PATCH changes part, DELETE removes).
Changing routes need an admin login, inputs are checked, and after a change I
tell connected viewers to refresh."

---

## 4. `events.js`: live updates

**Why it exists.** When an admin scores a point, everyone else watching should
see it without refreshing. Each viewer's browser keeps one connection open to
`GET /api/events`, and when something changes the server sends a short
message down every open connection. This is called **server-sent events
(SSE)**.

**Who uses it**
- `server.js`: the `/api/events` route calls `subscribe`.
- Every change calls `broadcast`, through `announce`.
- The website's `api/httpApi.js` listens with `new EventSource('/api/events')`.

**The message format** is plain text, and each message ends with a **blank
line** (`\n\n`):
- `data: {"type":"tournament","id":"…"}\n\n` is a message the browser receives.
- `: ping\n\n` is a comment line. Browsers ignore it, but it keeps the connection from looking idle.
- `retry: 5000\n\n` tells the browser to reconnect after 5 seconds if the connection drops.

### State
- **A `Set` of connected clients.** Each one is an object holding its `response` and its `address`.

### `subscribe(request, response, address)`
1. **Refuse when there are too many connections,** so nobody can exhaust the server by opening thousands:
   - more than **500 in total**, or more than **6 from one address**;
   - answer `response.status(429).json({ error: 'Too many live connections.' })` and stop.
2. **Send the headers with `response.writeHead(200, { … })`:**
   - `'Content-Type': 'text/event-stream'`
   - `'Cache-Control': 'no-cache, no-transform'`
   - `Connection: 'keep-alive'`
   - `'X-Accel-Buffering': 'no'`
3. **Write `retry: 5000\n\n`.**
4. **Add this client to the Set.**
5. **Every 25 seconds, write `: ping\n\n` (`setInterval`).** Cloudflare and other proxies close connections that are silent for about 100 seconds.
6. **When the viewer leaves (`request.on('close', …)`):** stop the interval (`clearInterval`) and remove the client from the Set. Otherwise the Set grows forever.

### `broadcast(event)`
- **`event` is an object** like `{ type: 'tournament', id, origin }`.
- **Turn it into one line:** `` `data: ${JSON.stringify(event)}\n\n` ``.
- **Write that line to every client's `response`.**
- **No `try`/`catch` is needed.** Closed connections are removed by the `close` handler.

**How to explain it:** "Viewers hold a connection open. When an admin changes
something, I send a one-line 'changed' message to everyone, and their page
reloads its data. A heartbeat keeps the connections alive, and there's a cap
so no one can open thousands."

---

## 5. `matchesRepo.js`: matches (optional)

**Why it exists.** Every query on the `matches` table. A match row holds its
tournament, its place in the bracket, the two players, the scores, the
winner, and where the winner (and loser) go next.

**Who uses it:** `tournamentService.js`.

**The columns** (from `db/schema.sql` and the migration):
- **Identity and placement:** `id`, `tournament_id`, `round_number`, `round_label`, `round_index`, `position`, `code`, `bracket_side`, `best_of`
- **Players and score:** `team_a_id`, `team_b_id`, `score_a`, `score_b`, `winner_id`
- **Flags (all true/false):** `is_bye`, `is_void`, `is_third_place`, `is_grand_final`, `is_reset`
- **Links:** `next_match_id`, `next_slot`, `loser_next_match_id`, `loser_next_slot`

The service hands you **rows that already use these column names**, so your
`AS x(...)` lists just repeat them with their types. Use `uuid` for ids,
`int` for numbers, `text` for text and `boolean` for flags.

| Function | What it does | Returns |
|---|---|---|
| `getAll(pool)` | Every match (`SELECT *`) | rows |
| `getByTournament(pool, tournamentId)` | One tournament's matches | rows |
| `createMany(pool, tournamentId, rows)` | Insert all of a tournament's matches in one query (the `jsonb_to_recordset` trick from section 2), with every column **except the 4 link columns** | nothing |
| `linkMany(pool, tournamentId, rows)` | One `UPDATE … FROM jsonb_to_recordset(...)` that fills in the 4 link columns, matching rows by `id` **and** `tournament_id` | nothing |
| `updateMany(pool, tournamentId, rows)` | Save scores and results. Each row has `id, team_a_id, team_b_id, score_a, score_b, winner_id, is_bye, is_void`. The same `UPDATE … FROM` pattern, matched on `id` **and** `tournament_id`. | `result.rowCount` (the service checks it equals the number sent, so a match from another tournament is caught) |
| `updateRoundLength(pool, tournamentId, roundIndex, bestOf)` | `UPDATE matches SET best_of = $3 WHERE tournament_id = $1 AND round_index = $2` | nothing |
| `hasResults(pool, tournamentId)` | Whether any match has a real result or a live score | `true`/`false` |
| `removeByTournament(pool, tournamentId)` | Delete all of a tournament's matches | nothing |

**Notes**
- **Why insert first and link second?** `next_match_id` is a foreign key to another match. When you insert the matches, the match it points to may not exist yet, and Postgres would refuse. So insert them all with empty links, then fill in the links once every match exists. Both steps run inside one transaction, which the service handles, so either both happen or neither does.
- **`hasResults`:** count a match as started if `(winner_id IS NOT NULL AND NOT is_bye) OR score_a IS NOT NULL OR score_b IS NOT NULL`. Byes have a winner but don't count as played. `SELECT EXISTS (SELECT 1 FROM matches WHERE …) AS started` returns one row whose `started` is true or false.
- **The `UPDATE … FROM` pattern** looks like this on the made-up `pets` table:
  `UPDATE pets p SET age = x.age FROM jsonb_to_recordset($2::jsonb) AS x(id uuid, age int) WHERE p.id = x.id AND p.owner_id = $1`

**How to explain it:** "Every query on matches. Saving a bracket inserts all
the matches in one query and then links them to the next match. Scoring
updates only the matches that changed, and checks they belong to this
tournament."

---

## When you're done

1. **Ask Claude to run the API test.** All 50 checks should pass.
2. **Commit each file separately** with a clear message, so the commit links show your work.
3. **In `AI-USAGE.md` section 3 ("Written by me"),** list each file with its commit, and explain it in your own words. The "How to explain it" lines above are a starting point, not something to paste. Also mention that Claude added the marked functions in your two repos.
