# Weekly reports

The full weekly reports were submitted each week from my workspace
(`project/REPORT.md`; the week 1 copy is also in this repo's `REPORT.md`). This
file is a short summary of each week, newest first, compiled on 2026-10-07 from
the commit history.

---

## Week of 2026-10-05

**Done.** Committed the database-connected app: the REST API, admin login and
security hardening (`5464de0`), my own players, admins and entries repos and the
live-update stream (`c952329`), and the redesigned client (`cb6be54`). Rewrote the
README, the AI usage log and the deployment guide. Deploying as one Render web
service.

**Stuck.** Writing my own server files took longer than expected: my first
`playersRepo.js` was missing `getByNames`, which broke creating tournaments with
a 500 until the API test pointed at it.

**Next.** Deploy on Render, record the demo video, submit.

---

## Week of 2026-09-28

**Done.** Three tournament formats (single elimination, double elimination,
round robin), live scoring on the bracket, best-of match lengths, the games-first
Stats page (`ae68a35`). Connected the app to Supabase through the Express API, a
real admin login, live updates for viewers, the security checklist, and the
redesign from my Figma palette.

**Stuck.** Results disappeared after a page reload, because each match was stored
twice and only one copy was updated. The app was also connecting to the database
as the owner, which the security checklist caught.

**Next.** Write my own server files, commit, deploy.

---

## Week of 2026-09-21

**Done.** Routing for the five wireframe screens, bracket generation with byes,
the Setup, Bracket view, Match detail and Stats pages (`78bd057`), the week 1
report and AI usage log (`9c6a0d3`), styling fixes, a temporary admin mode, and
the database schema, seed data and `tournamentsRepo.js` (`dbdf7ab`).

**Stuck.** A player could reach the Final without playing a semifinal, because an
undecided opponent was treated as a bye. Several pages were blank because of
import and filename mismatches.

**Next.** Connect the client to a real database, more formats.
