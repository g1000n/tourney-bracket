# Guide: writing `server/playersRepo.js`

> **Done.** I wrote `playersRepo.js` from this guide (commit `c952329`), and it passes the API test. The guide is kept as a record of the spec I worked from; the "placeholders" and "501" below describe the state before I wrote it.

This file is yours to write (it's the "written by me" part in `AI-USAGE.md`).
Everything around it is already wired. `server.js` calls the five functions below,
and the client already uses the routes. Right now `playersRepo.js` holds placeholders
that make each route answer **501 Not implemented**. Replace them one at a time; each
route starts working as soon as its function does.

Use the same style as your `tournamentsRepo.js`: every function takes `pool` first,
uses `$1, $2…` placeholders (never build SQL by joining strings), and returns plain
rows.

## What already exists (you don't need to write it)

- **The `players` table**: `id UUID`, `name VARCHAR(100)`, with a unique index on
  `lower(name)`. Two players can't be called "Ana" and "ana".
- **Creating players.** When a tournament is saved, `tournamentService.js` finds each player
  by name (ignoring capitals), or inserts them if they're new. A player is one record
  across every tournament and game.
- **Where a player's data lives:**
  - `tournament_players`: which tournaments they entered, with `rank` (the seed the
    admin typed, so per tournament and therefore per game) and `seed` (the seed they
    actually got).
  - `matches`: `team_a_id`, `team_b_id`, `winner_id`, `score_a`, `score_b`, `is_bye`.
  - `tournaments`: `game`, `status`, `created_at`.

## The five functions

### 1. `getAll(pool)` → array

Route: `GET /api/players`. The New Tournament page uses it for the player dropdown.

- Return every player as `{ id, name }`, sorted by name.
- One `SELECT … FROM players ORDER BY …`.
- Until this works, the app builds the list from the players it finds in tournaments,
  so nothing breaks.

### 2. `getById(pool, id)` → row or `null`

Route: `GET /api/players/:id`.

- Same idea as `getById` in `tournamentsRepo.js`.
- Return `result.rows[0] ?? null`. The route turns `null` into a 404.

### 3. `getStats(pool, id)` → array

Route: `GET /api/players/:id`, which sends back the player plus `stats`.

Return one row per game, e.g. `{ game, played, wins, losses }`.

- Start `FROM matches` and `JOIN tournaments` on `tournament_id`, so you have the
  `game`.
- **Only count real, finished matches:** `winner_id IS NOT NULL` and `is_bye = false`.
- **The player is in the match** when `team_a_id = $1 OR team_b_id = $1`. Put the
  `OR` in brackets.
- `GROUP BY` the game.
- **A win** is `winner_id = $1`; **a loss** is any other finished match they're in.
  - `COUNT(*) FILTER (WHERE …)` lets you count both in one query.
  - Or use `SUM(CASE WHEN … THEN 1 ELSE 0 END)`.
- `COUNT` comes back from `pg` as a **string**, because Postgres `bigint` can exceed
  JavaScript numbers. Add `::int` in SQL, or `Number()` in JS.

### 4. `rename(pool, id, name)` → updated row or `null`

Route: `PATCH /api/players/:id` with body `{ "name": "New Name" }`. This is the Rename
button on the bracket page's "Manage tournament" panel and on the Stats page.

- `UPDATE players SET name = $2 WHERE id = $1 RETURNING id, name`.
- Return the row, or `null` if no row matched (the route turns that into a 404).
- If the new name is already taken, Postgres raises error `23505` (duplicate value).
  `server.js` already turns that into a friendly 409, so you don't need to handle it.

### 5. `remove(pool, id)` → `true` / `false`

Route: `DELETE /api/players/:id`. This is the Delete button on the Stats page. The
client first removes the player from any tournaments that haven't started.

- Same as `remove` in `tournamentsRepo.js`: `DELETE … RETURNING id`, then return
  `result.rowCount > 0`.
- If the player is still in a tournament, Postgres refuses with error `23503` (still
  referenced). `server.js` already turns that into a 409 "still in a tournament".

## Testing each function

Start the API and the client:

```bash
cd server && npm run dev
```

```bash
cd client && npm run dev
```

- **Read routes:** open these in the browser.
  - `http://localhost:3000/api/players` should show the list, not
    `{"error":"…not set up…"}`.
  - `http://localhost:3000/api/players/10000000-0000-0000-0000-000000000001` should
    show Alex from the seed data, plus `stats`.
- **Write routes** need an admin login, so test them through the app: log in, then use
  Rename or Delete on the Stats page.

## About rank, per game

- `rank` belongs to an entry in a tournament (`tournament_players`), and a tournament is
  always one game, so ranks are already per game. Don't add a rank column to `players`.
- On the New Tournament page, choosing a game fills each player's seed with the rank
  they had in the most recent tournament of that same game. That's calculated from
  `tournament_players`, so it needs nothing from this file.
