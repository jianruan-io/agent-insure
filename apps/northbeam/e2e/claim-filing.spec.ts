import { test, expect } from '@playwright/test';

/**
 * No mocking here, on either side — unlike selfie-check.spec.ts, which mocks the World
 * boundary deliberately. `POST /api/claims` hits the real Express server (started for
 * real by playwright.config.ts's webServer), so a passing run is proof the wiring works,
 * not proof a mock was set up correctly.
 */
test.describe('AP controller files a claim against a real backend record', () => {
  test('filing a claim creates a real backend record and renders it with the server-issued id', async ({ page }) => {
    await test.step('lock the spending rules', async () => {
      await page.goto('/rules');
      await page.getByRole('button', { name: 'Lock Rules On-Chain' }).click();
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
