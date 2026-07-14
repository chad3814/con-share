import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Auth.js v5 refuses requests from hosts it doesn't recognize unless
    // trustHost is set. Vercel sets this automatically in production; a
    // locally-run `next start` (as used for the E2E webServer) needs it
    // set explicitly. Test-infra-only — does not affect the app's own env.
    env: { ...process.env, AUTH_TRUST_HOST: "true" },
  },
});
