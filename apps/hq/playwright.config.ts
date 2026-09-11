import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Trace always captured, headed always — same convention as apps/business/playwright.config.ts.
  use: {
    baseURL: 'http://localhost:6324',
    trace: 'on',
    video: 'off',
  },
  headless: false,
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:6324',
      reuseExistingServer: !process.env.CI,
    },
    {
      // The real shared backend — claim storage and InvestigatorAgent's real Mirror Node +
      // ENS reads need this actually running, not just the frontend.
      command: 'npm start',
      cwd: '../../server',
      url: 'http://localhost:8787/health',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
