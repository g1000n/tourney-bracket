# Weekly Increment Report

## Week of: September 23, 2026

## What changed this week

- Set up React Router with routes matching the five wireframe screens: Tournaments (dashboard), Setup, Bracket view, Match detail, Stats
- Built shared components (`Header`, `Footer`, `BackLink`) using CSS Modules and the design system's color/spacing/type tokens
- Wrote the bracket-generation logic (`client/src/lib/bracket.js`): seeding by rank, automatic byes for uneven player counts, round-by-round match wiring
- Built the Setup page (create a tournament: game, round name, players with optional rank)
- Built the Bracket view page (rounds displayed as columns, matches as cards)
- Built the Match detail page (score entry, winner advancement)
- Built the Stats page (per-game tournament counts, per-player win counts and match history, matched by player name)
- Added a `TournamentsContext` backed by `localStorage` as a stand-in data layer until the real backend exists

## Why

These five screens are the direct translation of the proposal and wireframes into working routes. The bracket logic was pulled into its own module, separate from any page, specifically so it can be swapped for a server-side version later without having to rewrite the UI.

## What broke or what I got stuck on

Several early errors came from writing an import statement before the file it pointed to actually existed (missing `.module.css` files, one file with a stray `.jsx` appended to a `.css` filename). Also had a page filename (`SetUpPage.jsx`) that didn't match its import (`SetupPage`) — worked locally on Mac because that filesystem is case-insensitive, but would have broken on deployment.

The real issue was a logic bug in the bracket generator: a player could advance to the next round without playing a match, because the code treated "this match's opponent isn't decided yet" the same as "this is a genuine bye." Found it by generating a 5-player tournament and tracing why one player reached the Final without their semifinal ever being played. Fixed by only marking a match as a bye when exactly one side is genuinely missing, and building later rounds as empty placeholders that only fill in once the real previous match is actually played.

## What is left

- No real backend yet — data lives in `localStorage`, not PostgreSQL
- Build the Express API and PostgreSQL schema, then swap the client's local state for real API calls
- Add a single-admin login so only the host can create tournaments or submit results, while viewing stays public
- Add a leaderboard/standings panel to the Bracket view screen
- Deploy: Cloudflare Pages for the client, a separate host for the API and database
