# Proposal

The submitted version is my Canvas answer for m8a1. This copy is kept up to date
with what was actually built, so the plan and the code sit next to each other.

## The problem and who it's for

People hosting casual gaming tournaments (a LAN night, an online event among
friends) usually do the seeding and the bracket by hand, on paper or in a
spreadsheet. Byes for uneven player counts are easy to get wrong, and nobody but
the host can see the scores. TourneyBracket builds the bracket, handles the byes,
lets the host score matches, and shows everyone the results live, while keeping
each player's record across tournaments.

## Core features

| Feature | Status |
|---|---|
| Create a tournament from a list of players, with optional ranks | Built |
| Single-elimination bracket with automatic byes | Built |
| Enter match results; the winner advances | Built, as live point-by-point scoring on the bracket |
| Stats: games hosted, each player's wins and match history | Built, grouped by game with a leaderboard per game |
| Viewing is public; only the host can change anything | Built, with a real admin login |
| Data in PostgreSQL, shared between devices | Built (Supabase) |

Added during the project: double elimination and round robin, a 3rd-place
match, best-of match lengths per round, random seeding by default, live updates
for viewers, searchable game and player dropdowns, and admin controls to rename
or remove players and delete tournaments.

## Changed or cut

- **The Match detail page was cut** (2026-10-01). Scoring moved onto the match
  cards on the bracket, which is faster for the host.
- **The leaderboard panel on the Bracket view** became a standings table for
  round robin and a per-game leaderboard on the Stats page.

## Stretch goals (not built)

- Forfeits and withdrawals after a tournament has started
- Protection against two admins scoring the same match at once
- Swiss format; a shareable bracket image

## Where each piece is hosted

| Piece | Host | Free tier's catch |
|---|---|---|
| Client and API | One Render web service (the Express server also serves the built React site) | Sleeps after about 15 minutes without visitors; the next visit takes up to a minute |
| Database | Supabase PostgreSQL | The project pauses after a week without use |

**Change of plan (2026-10-05):** the original plan was GitHub Pages or
Cloudflare Pages for the client and a separate API host. I switched to one
Render service so the site and API share one address: no CORS setup, and live
updates work without extra configuration.

## Demo mode

The client used the real API from 2026-10-02 in development. The deployed build
(`npm run build:server`) always uses the real API, so the live site has no demo
mode. Demo mode remains only as an option for running the client without a server.

## Risks

| Risk | What happened |
|---|---|
| Bracket logic bugs with uneven player counts | Real: two were found and fixed (see `AI-USAGE.md`). Now covered by a simulation test, `npm run check:brackets`. |
| Exposing the database or admin access | Reduced: restricted database login, Supabase's public API closed, hashed passwords, login lockout. See `SECURITY-CHECKLIST.md`. |
| Free tier asleep during the demo | Still there: open the site a few minutes early. |
| Double elimination rematches with 16+ players | Can't be fully avoided with this bracket shape; documented as a known issue. |
