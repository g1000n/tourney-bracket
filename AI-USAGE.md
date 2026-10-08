# AI usage

This project was built with AI assistance. This file is the record of it. It is graded as the finals badge, and it is worth 100 points.

Start it in week 1 and keep it up as you go. The commit history of this file is part of the evidence: a file written all at once the night before the deadline looks exactly like what it is.

## 1. How I used AI

### 2026-09-23 - Setting up React Router and the project's routing skeleton

* **Tool:** Claude

* **What I asked for:** help getting the React/Vite client running and setting up routing for the five screens from the wireframes, since I was still fairly new to React.

* **What it gave back:** step-by-step setup guidance, then App.jsx routing code and placeholder page components.

* **What I kept, what I changed, and why:** kept the routing structure; had to create several missing files myself (module.css files, a mismatched page filename) before it actually ran.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### 2026-09-23 - Bracket generation logic

* **Tool:** Claude

* **What I asked for:** help writing the algorithm that seeds players and generates a single-elimination bracket, handling byes for uneven player counts.

* **What it gave back:** a bracket.js module with seeding and bracket-building functions.

* **What I kept, what I changed, and why:** the first version had a real bug (see Where the AI got it wrong, Case 1); had it rewritten to fix it.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### 2026-09-23 - Setup, Bracket view, Match detail, and Stats pages

* **Tool:** Claude

* **What I asked for:** help me build the remaining pages to match the wireframe and the design tokens from the design system

* **What it gave back:** page components and their stylesheets.

* **What I kept, what I changed, and why:** kept the structure; still testing and fixing issues as I try different tournament sizes.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### 2026-09-23 - Design tokens and CSS Modules setup

* **Tool:** Claude

* **What I asked for:** help translating the design system doc's colors, type scale, and spacing into actual CSS custom properties, and setting up CSS Modules so each component's styles stay scoped.

* **What it gave back:** the :root token block and the per-component .module.css pattern.

* **What I kept, what I changed, and why:** kept the token names and values as planned in the design system doc.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### 2026-09-23 - Stats page and win-count logic

* **Tool:** Claude

* **What I asked for:** a Stats page that shows games hosted and each player's win count with expandable match history.

* **What it gave back:** logic that walks through every match across tournaments and tallies wins per player by name.

* **What I kept, what I changed, and why:** kept the approach; noted as a known limitation that it matches players by name rather than a stable player ID.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### 2026-09-23 - Git authentication troubleshooting

* **Tool:** Claude

* **What I asked for:** help after `git push` failed with an authentication error.

* **What it gave back:** options (GitHub CLI, GitHub Desktop, a personal access token) since a Homebrew install failed due to a network issue.

* **What I kept, what I changed, and why:** used the personal access token method, since it didn't need installing anything new.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### 2026-10-01 - Three tournament formats (round robin, single elim, double elim)

* **Tool:** Claude Code

* **What I asked for:** help me improve the bracket system and add support for round robin, single elimination, and double elimination, with the admin able to choose the format

* **What it gave back:** split `client/src/lib/bracket.js` into a shared engine (`bracketCore.js`) plus one module per format (`singleElimination.js`, `doubleElimination.js`, `roundRobin.js`); a format picker on the Setup page; bracket/standings rendering per format; a 3rd-place match; ranked-then-shuffled seeding; a fix for results disappearing after a page reload (rounds and allMatches were two separate copies once saved to localStorage); a DB migration for the new columns; and a simulation script that plays thousands of random tournaments to check the logic. Follow-up requests in the same session added: inline live scoring on the bracket (−/+ per point, Finish, Edit result to reopen a match), best-of-N match lengths set per round (with a separate "semifinals onward" length), random-by-default seeding with non-negative seed fields, admin controls (delete tournaments, rename/remove players) on existing pages, and a games-first Stats page with expandable games/tournaments and search.

* **What I kept, what I changed, and why:** I kept the overall format structure and the main tournament features, but I changed and tested several parts as I found problems while using the app. The bracket data was changed so `allMatches` is the single source of truth instead of keeping a second copy inside each round, and scoring was moved into the bracket view instead of a separate match-detail page. I also kept changing smaller parts of the seeding, match lengths, player management, and Stats behavior until they worked better with the rest of the app.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/ae68a35fbc1f32d5b5eab4a90a455c8a10cf55f0

### 2026-10-02 - Connecting the app to the database, and a REST API

* **Tool:** Claude Code (Claude Opus 5.5)

* **What I asked for:** connect the React app to the Supabase database through the Express API, with a real admin login instead of the hard-coded demo one, then reorganise the routes to follow REST.

* **What it gave back:** REST routes in `server/server.js` (`/api/tournaments`, `/api/players`, `/api/sessions`), `server/tournamentService.js` (saving and loading whole brackets in transactions), `server/matchesRepo.js`, server-side validation in `server/tournamentPayload.js`, and a login with scrypt-hashed passwords and signed tokens (`server/auth.js`, `server/db/create-admin.js`). The client sends only the matches that changed after each click.

* **What I kept, what I changed, and why:** I chose a real login over an app-wide password, so visitors can watch without logging in. I asked it **not** to write the players data layer, the admins and entries repos, the live-update file or the players routes; it wrote specifications for them instead, and I wrote them myself (the 2026-10-03 entry and section 3). It kept my `tournamentsRepo.js` functions and added one, `update`, marked as its own in the file.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/5464de0

### 2026-10-02 - Security checklist and hardening

* **Tool:** Claude Code (Claude Opus 5.5)

* **What I asked for:** review the project using the course's security checklist, identify the parts that needed attention, and help me make the necessary security changes before making the repository public.

* **What it gave back:** a restricted database login for the app (`server/db/create-app-role.js`), a migration that removes Supabase's default public table permissions (`002_lock_public_api.sql`), a login limiter (5 failures per address, 10 per username, 15-minute lock), security headers, and GitHub Actions pinned to commit SHAs. It filled in `SECURITY-CHECKLIST.md` with the evidence for each row.

* **What I kept, what I changed, and why:** kept all of it. The checklist showed the app was connecting as the database owner (Case 4 below), which I hadn't known. It also showed personal email addresses in the commit history, so I rewrote the history on 2026-10-07 so every commit uses my GitHub noreply address.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/5464de0

### 2026-10-02 - Redesign from my Figma file, live updates and dropdowns

* **Tool:** Claude Code (Claude Opus 5.5)

* **What I asked for:** update the site to match my new design from Figma, including the logo and colour palette, add curly-brace connectors between bracket rounds, make score changes appear for other viewers without refreshing, and add searchable game and player dropdowns.

* **What it gave back:** a retro theme built from my palette, my logo as SVG, brace-shaped connectors drawn from the positions of the match cards, a `Combobox` component, and client code that listens to `/api/events` and reloads the data when something changes (ignoring its own changes). It pre-fills each player's seed from their last tournament of the same game.

* **What I kept, what I changed, and why:** kept the redesign; it read my Figma file directly to match the colours and logo. The live-update server side (`server/events.js`) is my code; this commit is the client half that listens to it.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/cb6be54

### 2026-10-03 - Specifications for the parts I wrote myself

* **Tool:** Claude Code (Claude Opus 5.5)

* **What I asked for:** help me write a guide for each of the server pieces I wanted to do myself, explaining what each function should do, what it should take and return, and what I needed to keep in mind while writing it, without giving me the actual code. I also asked it to test my versions after I finished each piece.

* **What it gave back:** a spec for each file explaining the purpose of the functions, their inputs and outputs, and how they should work, along with an API test with 50 checks that it ran against my versions and used to point out what was failing.

* **What I kept, what I changed, and why:** I wrote `playersRepo.js`, `adminsRepo.js`, `entriesRepo.js`, `events.js` and the players routes myself. My `entriesRepo.createMany` uses a simple loop of inserts instead of the one-query version in the guide, because it is easier for me to follow and explain; a tournament only has a handful of players, so the extra queries do not matter. When my `playersRepo.js` was missing `getByNames`, the test caught it (creating a tournament failed) and I added it back. I decided not to write `matchesRepo.js`, so it stays AI-written.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/c952329

## 2. Where the AI got it wrong

### Case 1 - Players advancing without playing a match

* **What it gave me:** bracket-generation code that treated an unplayed future match the same as a genuine bye.

* **What was wrong with it:** a player could reach the Final without ever playing a semifinal, whenever the player count wasn't a clean power of two.

* **What I did instead:** had it rewritten so a match only counts as a bye when exactly one side is genuinely missing, not when both sides are simply undecided yet.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### Case 2 - Initial page scaffolding had wiring errors

* **What it gave me:** the first version of the routing setup and page components, including a stray leftover brace in App.jsx from the old sample app, a CSS file named with both a .css and .jsx extension, and a page rendering blank because the data provider wasn't actually wired into main.jsx yet.

* **What was wrong with it:** several of these caused pages to show nothing at all, or crash with import errors, with no single obvious cause visible from the browser alone.

* **What I did instead:** went through each error one at a time, checked the exact file paths and import statements against what actually existed on disk, and fixed the mismatch each time.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/78bd0575b93fc0a394fd2efc91dd52ab9f05fb58

### Case 3 - Results disappeared after a page reload

* **What it gave me:** the week 1 bracket code stored every match twice in each tournament: once inside `rounds[].matches` and once in `allMatches`.

* **What was wrong with it:** in one page session both were the same objects, so it looked fine. After saving to `localStorage` and reloading, they became two separate copies. Results were written to `allMatches`, but the page drew `rounds` and checked `rounds` to decide whether the tournament was finished. So after a refresh new results didn't show, and a tournament could never complete.

* **What I did instead:** had it changed so rounds hold only match ids and `allMatches` is the one place matches live, with old saved tournaments converted on load. The `check:brackets` script now replays thousands of tournaments to catch this kind of thing.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/ae68a35

### Case 4 - The app connected to the database as its owner

* **What it gave me:** when Claude Code connected the server to Supabase, it built everything on the `DATABASE_URL` already in my `.env`, which was the database owner's login, and didn't point out that this was a problem.

* **What was wrong with it:** the owner login can drop or empty any table, so a single bug or injected query in the app could wipe everything. Supabase's public API roles also still had their default permissions, including TRUNCATE, which Row Level Security doesn't block. Neither came up until I went through the security checklist.

* **What I did instead:** had it create a separate `tourney_app` login that can only read and write the app's four tables (read-only on admins, no TRUNCATE), kept the owner login for setup scripts only (`OWNER_DATABASE_URL`), and removed the public roles' permissions with `npm run db:lock`. Then tested that the public API is refused and the app still works.

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/5464de0

## 3. Who wrote what

At least a fifth of this project is code you wrote yourself. Name it, and explain it in your own words.

### Written by me

* **File:** `server/playersRepo.js`, `server/adminsRepo.js`, `server/entriesRepo.js`, `server/events.js`

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/c952329

* **What it does and why it is built this way:** These files handle database access for players, admin accounts, and tournament entries, plus the live-update connections. I followed the same simple pattern as `tournamentsRepo.js`: the database pool is passed into each function, values use SQL parameters, and the functions return rows or a simple success result. The events file keeps track of connected viewers and broadcasts a small update message when something changes. I kept the repository functions simple so each one has a clear database task.

* **File:** `server/tournamentsRepo.js` (`getAll`, `getById`, `create`, `remove`; `update` was added by Claude Code and is marked in the file)

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/ae68a35 (the empty TODO version was in https://github.com/g1000n/tourney-bracket/commit/dbdf7ab)

* **What it does and why it is built this way:** It handles the basic database operations for tournaments, like getting, creating, and deleting them (the update function was added by Claude Code) by using queries in the pool. I’m familiar with this because our previous activities used essentially the same pattern and style, and I also used the template as a basis to help me understand how the queries should be structured. I kept it simple because each function has a clear purpose, and the queries are straightforward enough for me to read and understand.

* **File:** the `/api/players` routes in `server/server.js` (the `// --- Players ---` section)

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/5464de0

* **What it does and why it is built this way:** The player routes handle actions such as viewing players, adding and deleting players, renaming them, and checking their stats. I’m also familiar with this because our previous activities used similar Express routes, and I used the template as a basis for understanding how the routes should connect to the repository functions. I kept the structure similar to the tournament routes so it is easier to follow, while still adding the admin checks and input validation needed for actions that change player data.

### The AI-written part I understand best

* **File:** `server/tournamentPayload.js`

* **Commit:** https://github.com/g1000n/tourney-bracket/commit/5464de0

* **What it does and why we kept it:** It checks tournament data on the server before it reaches the database. It validates things like IDs, player names, scores, tournament formats, rounds, and match links, so the API does not have to trust whatever the browser sends. I kept it because the client can be bypassed and the server still needs to check that the data has the expected shape. The validation is kept in a separate file so the route handlers do not have to contain all of those checks themselves.
