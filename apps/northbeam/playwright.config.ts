import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Trace and video are always captured, headed always — per explicit instruction,
  // not just on retry/failure, so every run leaves behind something a person can watch.
  use: {
    baseURL: 'http://localhost:6323',
    trace: 'on',
    video: 'on',
  },
  headless: false,
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:6323',
      reuseExistingServer: !process.env.CI,
    },
    {
      // The real shared backend — claim filing (and anything else that isn't mocked at
      // the page.route boundary) needs this actually running, not just the frontend.
      command: 'npm start',
      cwd: '../../server',
      url: 'http://localhost:8787/health',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
