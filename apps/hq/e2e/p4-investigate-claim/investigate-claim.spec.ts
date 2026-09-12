import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:8787';

/**
 * Seeds a real disputed claim directly against the server, not by re-driving Northbeam's
 * own UI — filing a claim is a different Goal (g-notice-file). This test stays scoped to
 * InvestigatorAgent's own real judgment: real Mirror Node history + real ENS-locked rules.
 */
async function seedClaim(request: import('@playwright/test').APIRequestContext, account: string, activityId: string) {
  const response = await request.post(`${API_URL}/api/claims`, {
    data: { vendor: 'Acme Corp', amount: 500, activityId, account },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

/**
 * No mocking anywhere in this flow — Run Investigation hits the real running Express server
 * (started for real by playwright.config.ts's webServer), which itself queries the real
 * Hedera Mirror Node for this vendor's payment history and reads the real, ENS-locked
 * spending rules from Sepolia. A passing run is proof InvestigatorAgent's rule-based verdict
 * is real, not proof a mock was set up right.
 */
test.describe("InvestigatorAgent checks a disputed payment against PayableAgent's locked rules and real Hedera history", () => {
  test('signs a real FRAUD verdict for the account outside the locked rule, and a real CLEARED verdict for the one that matches', async ({
    page,
    request,
  }) => {
    // Each investigation is a real Hedera Mirror Node query plus a real Sepolia/ENS read.
    test.setTimeout(60_000);

    const fraudClaim = await seedClaim(request, '0.0.10465722', 'e2e-investigate-fraud');
    const clearedClaim = await seedClaim(request, '0.0.10465723', 'e2e-investigate-cleared');

    await page.goto('/claims');

    await test.step("pulls real Mirror Node history + real ENS-locked rules, and signs FRAUD for the account that doesn't match", async () => {
      await page.locator('button', { hasText: `#${fraudClaim.id} Northbeam` }).click();
      await expect(page.getByRole('heading', { name: `Claim #${fraudClaim.id} — Acme Corp` })).toBeVisible();

      const investigated = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/claims/${fraudClaim.id}/investigate`) && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Run Investigation' }).click();
      const response = await investigated;
      expect(response.status()).toBe(200);
      const body = await response.json();

      // Real, InvestigatorAgent-computed verdict — never a hardcoded client string.
      expect(body.verdict).toBe('FRAUD');
      expect(body.reasoning).toMatch(/0\.0\.10465723/);

      await expect(page.getByText('VERDICT: FRAUD')).toBeVisible();
      await expect(page.getByText(body.reasoning)).toBeVisible();
    });

    await test.step("signs CLEARED for the account that matches the vendor's locked, approved account", async () => {
      await page.locator('button', { hasText: `#${clearedClaim.id} Northbeam` }).click();
      await expect(page.getByRole('heading', { name: `Claim #${clearedClaim.id} — Acme Corp` })).toBeVisible();

      const investigated = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/claims/${clearedClaim.id}/investigate`) && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Run Investigation' }).click();
      const response = await investigated;
      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.verdict).toBe('CLEARED');
      expect(body.reasoning).toMatch(/0\.0\.10465723/);

      await expect(page.getByText('VERDICT: CLEARED')).toBeVisible();
      await expect(page.getByText(body.reasoning)).toBeVisible();
    });
  });
});
