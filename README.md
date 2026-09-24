# TourneyBracket

A bracket generator for casual gaming tournaments. Built with help from Claude (Anthropic) — see [AI-USAGE.md](./AI-USAGE.md).

## 1. Overview

TourneyBracket generates fair single-elimination tournament brackets, handling byes automatically when the player count is uneven, and tracks match results and player stats across every tournament run. Built for anyone hosting casual LAN or online tournaments who's currently doing seeding and bracket math by hand.

## 2. Setup and installation

- Install [Node.js](https://nodejs.org/) (v18 or later) and npm.
- Clone the repo:
  ```
  git clone https://github.com/g1000n/tourney-bracket.git
  cd tourney-bracket/client
  ```
- Install dependencies:
  ```
  npm install
  ```
- **Environment variables:** none required yet. The client currently runs entirely in the browser (see Known Issues) — server environment variables will be documented here once the API is connected.
- **Database setup:** not yet connected. See Known Issues and Next Steps.

## 3. How to run it

```
cd client
npm run dev
```

Open `http://localhost:5173`. You should see the Tournaments dashboard (an empty-state message if no tournaments exist yet).

## 4. Features and usage

- **Create a tournament:** click "New tournament," enter a game, optionally a round name, add 2 or more players with an optional rank, click "Generate bracket."
- **View a bracket:** click any tournament card to see its rounds. Uneven player counts get byes automatically; the strongest-ranked players receive them.
- **Enter a result:** click a match that's ready to play (not greyed out), enter both scores (ties aren't allowed), click "Save result" — the winner advances automatically.
- **View stats:** click "Stats" from the dashboard to see every game hosted and each player's win count; click a player to expand their match history.
- No API endpoints exist yet — see Known Issues.

## 5. Project structure

```
client/
  src/
    components/   Shared UI: Header, Footer, BackLink, TournamentCard
    context/      TournamentsContext — current data layer (localStorage-backed)
    lib/          bracket.js — seeding and bracket generation logic
    pages/        One file per screen: TournamentsPage, SetupPage,
                  BracketViewPage, MatchDetailPage, StatsPage
server/          Express API skeleton (not yet connected to the client)
docs/            Planning documents
```

## 6. Screenshots
![alt text](image.png)
![alt text](image-1.png)

## 7. Known issues and next steps

**Known issues:**
- No shared backend yet — all data lives in the browser's `localStorage`, so nothing is shared between devices or visitors.
- Player stats match by name rather than a stable player ID, so two different players with the same name would be treated as one.

**Next steps:**
- Build the Express API and PostgreSQL schema, then connect the client to it
- Add a single-admin login so only the host can create tournaments or submit results, while viewing stays public
- Add a leaderboard/standings panel to the Bracket view screen
- Deploy: Cloudflare Pages for the client, a separate host for the API and database