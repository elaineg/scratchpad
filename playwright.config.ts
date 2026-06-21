import { defineConfig } from '@playwright/test';

// E2e tests run against a DEPLOYED url: BASE_URL=https://... npm run test:e2e
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 1,
  // Workers: 1 is required because multiple workers share the same local server and
  // TipTap's async dateline insertion (setTimeout(0)) can fire across parallel test
  // sessions, causing non-deterministic h2/li text to resolve as empty. Single worker
  // ensures tests run in isolation without shared browser-context interference.
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
});
