import { defineConfig } from '@playwright/test';

/**
 * One flat suite for the one insurance-cycle journey shown at
 * http://localhost:6322/proof/agent-insure-flywheel/insurance-cycle — apps/business
 * (Northbeam) and apps/hq (Agent Insure HQ) are two UIs for that single journey, not two
 * separate ones, so their specs live together here rather than under either app. Each
 * spec file sets its own `test.use({ baseURL })` for whichever app it drives.
 */
export default defineConfig({
  testDir: 'apps/e2e',
  fullyParallel: true,
  use: {
    trace: 'on',
    video: 'off',
  },
  headless: false,
  webServer: [
    {
      command: 'npm start',
      cwd: 'server',
      url: 'http://localhost:8787/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      cwd: 'apps/business',
      url: 'http://localhost:6323',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      cwd: 'apps/hq',
      url: 'http://localhost:6324',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
