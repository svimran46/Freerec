import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Set to test an already running server, such as `pnpm preview:cloudflare`, instead. */
const BASE_URL = process.env.E2E_BASE_URL;

/**
 * Browser tests for the tools that run on the visitor's device. Run `pnpm build`
 * first; the tests use the standalone server the Docker image runs.
 */
export default defineConfig({
  testDir: "e2e",
  // Server tools need the whole docker compose stack; CI's "stack" job sets this.
  testIgnore: process.env.E2E_SERVER_TOOLS ? [] : ["server-tools.spec.ts"],
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { ...devices["Desktop Chrome"], baseURL: BASE_URL ?? `http://localhost:${PORT}` },
  webServer: BASE_URL ? undefined : {
    command: [
      "cp -r .next/static .next/standalone/apps/web/.next/",
      "cp -r public .next/standalone/apps/web/",
      `PORT=${PORT} HOSTNAME=localhost node .next/standalone/apps/web/server.js`,
    ].join(" && "),
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
