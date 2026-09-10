import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'agent-insure-business-v1';

/**
 * Seeds `rules.locked` directly in localStorage instead of driving the real ENS
 * write-then-lock flow through the UI. This test's Goal is claim filing, not the ENS lock
 * itself — TECH-606's `lock-rules.spec.ts` is the one place that proves the real on-chain
 * lock, with no mocking of the chain interaction. Re-driving that same real, permanent,
 * gas-costing flow here on every claim-filing run would be slow and would re-test a
 * different Goal's mechanism, not this one.
 */
async function lockRulesForTest(page: Page) {
  await page.goto('/rules'); // first load seeds localStorage via the store's own seedState()
  await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    raw.rules = { ...raw.rules, locked: true };
    localStorage.setItem(key, JSON.stringify(raw));
  }, STORAGE_KEY);
  await page.reload();
}

/**
 * No mocking here, on either side — unlike selfie-check.spec.ts, which mocks the World
 * boundary deliberately. `POST /api/claims` hits the real Express server (started for
 * real by playwright.config.ts's webServer), so a passing run is proof the wiring works,
 * not proof a mock was set up correctly.
 */
test.describe('AP controller files a claim against a real backend record', () => {
  test('filing a claim creates a real backend record and renders it with the server-issued id', async ({ page }) => {
    await test.step('spending rules are already locked', async () => {
      await lockRulesForTest(page);
      await expect(page.getByText('Locked on ENS')).toBeVisible();
    });

    await test.step('simulate the poisoned invoice that gets flagged', async () => {
      await page.goto('/activity');
      await page.getByRole('button', { name: 'Simulate poisoned invoice' }).click();
      await expect(page.getByText('Flagged', { exact: true })).toBeVisible();
    });

    await test.step('file a claim and confirm the real backend created it', async () => {
      await page.goto('/claims');

      const claimCreated = page.waitForResponse(
        (response) => response.url().endsWith('/api/claims') && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: /File a Claim/i }).click();
      const response = await claimCreated;
      expect(response.status()).toBe(201);

      // The real proof: a claim card rendered on screen using the id the real backend
      // just issued (`claim-N`) — never the old client-invented `c1` format.
      await expect(page.getByText(/^#claim-\d+ Acme Corp payment$/)).toBeVisible();
      await expect(page.getByText('Live Selfie Check required')).toBeVisible();
    });
  });
});
