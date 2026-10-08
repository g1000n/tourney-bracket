# Deploying TourneyBracket

The Express server serves **both** the API and the built website from one
address, so there's no CORS setup and live updates work. It's hosted on
**Render** (free tier), with the database on **Supabase**.

```
Visitors ──https──▶ Render: node server.js
                      │  /            → the website (client/dist)
                      │  /api/...     → the API
                      └─ /api/events  → live updates
                         ▼
                      Supabase (Postgres)
```

## 1. One-time database setup (already done on 2026-10-02)

These were run on the Supabase database. You only need them again on a new
database. They use `OWNER_DATABASE_URL` from `server/.env`.

```bash
cd server
npm run db:migrate
npm run db:lock
npm run db:app-role -- --write-env
npm run admin:create -- yourname
```

- `db:migrate` adds the tables and columns the app needs (safe to run twice).
- `db:lock` removes Supabase's default public API permissions (anon/authenticated).
- `db:app-role` creates the restricted `tourney_app` login the app runs as, and
  writes it into `DATABASE_URL`.
- `admin:create` makes your admin account; it asks for the password.

## 2. Create the Render web service

1. render.com → sign up with GitHub → **New → Web Service** → pick this repository.
2. Settings:

| Field | Value |
|---|---|
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm ci && cd ../client && npm ci --include=dev && npm run build:server` |
| Start Command | `node server.js` |
| Instance Type | Free |
| Health Check Path (Advanced) | `/readyz` |

`--include=dev` is needed because Vite is a development dependency, and npm
skips those when `NODE_ENV=production`. `build:server` builds the website to call
the API at the same address it's served from.

3. Environment variables:

| Key | Value |
|---|---|
| `DATABASE_URL` | the restricted `tourney_app` connection string (the `DATABASE_URL` in `server/.env`, **not** `OWNER_DATABASE_URL`) |
| `AUTH_SECRET` | a new random value: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NODE_ENV` | `production` |
| `SERVE_CLIENT` | `true` |

Don't set `PORT` (Render sets it), `OWNER_DATABASE_URL`, `HOST`,
`TRUST_CLOUDFLARE` or `CORS_ORIGINS`.

4. **Create Web Service** and wait for "Live". Every push to `main` redeploys.

## 3. Check it

- `https://<your-service>.onrender.com/readyz` shows `{"ok":true,"db":"up"}`.
- Open the site on two devices, log in on one and score a point: the other
  updates within a second or two.
- The free instance sleeps after about 15 minutes without visitors, and the next
  visit takes up to a minute. Open it a few minutes before a demo.

## 4. Admin access for the instructor

Give your instructor an admin account (`npm run admin:create -- <name>`) and put
its username and password in your **private** workspace `project/README.md`,
never in this repository.

## 5. GitHub Pages workflow

`.github/workflows/deploy-pages.yml` came with the class template and publishes a
*demo-mode* copy of the site. Render serves the real site, so the workflow now
runs only when started by hand (Actions → Deploy client to GitHub Pages → Run
workflow), and only works after Settings → Pages → Source is set to **GitHub
Actions**.

## Alternative: self-hosting behind a Cloudflare Tunnel

The same server can run on your own machine, which must stay on while the site
is live.

1. Build the site: `cd client` then `npm run build:server`.
2. In `server/.env` set `NODE_ENV=production`, `SERVE_CLIENT=true`,
   `HOST=127.0.0.1`, `TRUST_CLOUDFLARE=true` and a new `AUTH_SECRET`.
   `HOST=127.0.0.1` means only the tunnel on the same machine can reach the
   server, which is what makes `TRUST_CLOUDFLARE=true` safe.
3. Start it: `cd server` then `npm run start:local`, and check http://localhost:3000.
4. Install `cloudflared` (Windows: `winget install --id Cloudflare.cloudflared`)
   and run `cloudflared tunnel --url http://localhost:3000`. It prints a
   temporary `https://….trycloudflare.com` address. For a permanent one, create
   a named tunnel in the Cloudflare dashboard (Zero Trust → Networks → Tunnels)
   and add a public hostname pointing at `localhost:3000`.
5. Optional: a Cloudflare rate-limit rule on `POST /api/sessions`. Don't put
   Cloudflare Access in front of the whole site, or viewers would have to log in.

## Live updates

Every viewer keeps one connection open to `/api/events`. When an admin saves
anything, the server sends a short "changed" message and each viewer's page
reloads its data within about a second. The server sends a heartbeat every 25
seconds so proxies don't close idle connections. Nothing to configure.
