// Builds the website to be served by the Express server itself
// (SERVE_CLIENT=true in server/.env), e.g. behind one Cloudflare Tunnel:
// real API instead of the demo, and API calls to the same address the
// page came from.
//
//   npm run build:server
//
// Works the same on Windows, macOS and Linux (no shell-specific env syntax).

import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_USE_MOCK_API: "false", VITE_API_BASE_URL: "", VITE_BASE_PATH: "/" },
});
process.exit(result.status ?? 1);
