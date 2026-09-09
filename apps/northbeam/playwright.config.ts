import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Trace is always captured, per explicit instruction — not just on retry/failure.
  use: {
    baseURL: 'http://localhost:6323',
    trace: 'on',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:6323',
    reuseExistingServer: !process.env.CI,
  },
});
