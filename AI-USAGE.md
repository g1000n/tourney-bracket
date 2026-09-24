# AI usage

This project was built with AI assistance. This file is the record of it. It is graded as the finals badge, and it is worth 100 points.

Start it in week 1 and keep it up as you go. The commit history of this file is part of the evidence: a file written all at once the night before the deadline looks exactly like what it is.

## 1. How I used AI

### 2026-09-23 - Setting up React Router and the project's routing skeleton

- **Tool:** Claude
- **What I asked for:** help getting the React/Vite client running and setting up routing for the five screens from the wireframes, since I was still fairly new to React.
- **What it gave back:** step-by-step setup guidance, then App.jsx routing code and placeholder page components.
- **What I kept, what I changed, and why:** kept the routing structure; had to create several missing files myself (module.css files, a mismatched page filename) before it actually ran.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

### 2026-09-23 - Bracket generation logic

- **Tool:** Claude
- **What I asked for:** help writing the algorithm that seeds players and generates a single-elimination bracket, handling byes for uneven player counts.
- **What it gave back:** a bracket.js module with seeding and bracket-building functions.
- **What I kept, what I changed, and why:** the first version had a real bug (see Where the AI got it wrong, Case 1); had it rewritten to fix it.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

### 2026-09-23 - Setup, Bracket view, Match detail, and Stats pages

- **Tool:** Claude
- **What I asked for:** build out the remaining pages to match the wireframe and the design tokens from the design system.
- **What it gave back:** page components and their stylesheets.
- **What I kept, what I changed, and why:** kept the structure; still testing and fixing issues as I try different tournament sizes.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

### 2026-09-23 - Design tokens and CSS Modules setup

- **Tool:** Claude
- **What I asked for:** help translating the design system doc's colors, type scale, and spacing into actual CSS custom properties, and setting up CSS Modules so each component's styles stay scoped.
- **What it gave back:** the :root token block and the per-component .module.css pattern.
- **What I kept, what I changed, and why:** kept the token names and values as planned in the design system doc.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

### 2026-09-23 - Stats page and win-count logic

- **Tool:** Claude
- **What I asked for:** a Stats page that shows games hosted and each player's win count with expandable match history.
- **What it gave back:** logic that walks through every match across tournaments and tallies wins per player by name.
- **What I kept, what I changed, and why:** kept the approach; noted as a known limitation that it matches players by name rather than a stable player ID.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

### 2026-09-23 - Git authentication troubleshooting

- **Tool:** Claude
- **What I asked for:** help after `git push` failed with an authentication error.
- **What it gave back:** options (GitHub CLI, GitHub Desktop, a personal access token) since a Homebrew install failed due to a network issue.
- **What I kept, what I changed, and why:** used the personal access token method, since it didn't need installing anything new.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

## 2. Where the AI got it wrong

### Case 1 - Players advancing without playing a match

- **What it gave me:** bracket-generation code that treated an unplayed future match the same as a genuine bye.
- **What was wrong with it:** a player could reach the Final without ever playing a semifinal, whenever the player count wasn't a clean power of two.
- **What I did instead:** had it rewritten so a match only counts as a bye when exactly one side is genuinely missing, not when both sides are simply undecided yet.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

### Case 2 - Initial page scaffolding had wiring errors

- **What it gave me:** the first version of the routing setup and page components, including a stray leftover brace in App.jsx from the old sample app, a CSS file named with both a .css and .jsx extension, and a page rendering blank because the data provider wasn't actually wired into main.jsx yet.
- **What was wrong with it:** several of these caused pages to show nothing at all, or crash with import errors, with no single obvious cause visible from the browser alone.
- **What I did instead:** went through each error one at a time, checked the exact file paths and import statements against what actually existed on disk, and fixed the mismatch each time.
- **Commit:** https://github.com/g1000n/tourney-bracket/commit/cedd3fd

## 3. Who wrote what

At least a fifth of this project is code you wrote yourself. Name it, and explain it in your own words.

### Written by me

- **File:**
- **Commit:**
- **What it does and why it is built this way:**

### The AI-written part I understand best

- **File:**
- **Commit:**
- **What it does and why we kept it:**