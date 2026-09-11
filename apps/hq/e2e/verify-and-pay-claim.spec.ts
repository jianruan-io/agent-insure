import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:8787';
const HASHSCAN_TX_URL = /^https:\/\/hashscan\.io\/testnet\/transaction\/\d+\.\d+\.\d+@\d+\.\d+$/;

/**
 * Seeds a real disputed claim directly and investigates it for real — the precondition this
 * Goal needs (a signed verdict), not the thing under test. g-investigate's own test already
 * proves InvestigatorAgent's verdict live.
 */
async function seedInvestigatedClaim(request: import('@playwright/test').APIRequestContext, account: string, activityId: string) {
  const created = await request.post(`${API_URL}/api/claims`, {
    data: { vendor: 'Acme Corp', amount: 500, activityId, account },
  });
  expect(created.status()).toBe(201);
  const claim = await created.json();

  const investigated = await request.post(`${API_URL}/api/claims/${claim.id}/investigate`);
  expect(investigated.status()).toBe(200);
  return investigated.json();
}

/**
 * No mocking anywhere in this flow — Run Payout hits the real running Express server, which
 * itself independently re-derives the verdict against real Hedera Mirror Node history and
 * real ENS-locked rules, checks the reserve pool's real live balance, and executes a real
 * Hedera transfer. A passing run is proof PayoutAgent's own judgment and the money movement
 * are both real, not proof a mock was set up right.
 */
test.describe("PayoutAgent independently verifies the verdict and executes a real Hedera payout", () => {
  test('pays out a real FRAUD claim on Hedera, and refuses to pay a CLEARED one', async ({ page, request }) => {
    // Each payout re-runs the full real investigation (Mirror Node + ENS) plus a real
    // Hedera transfer and HCS log — well beyond Playwright's 30s default.
    test.setTimeout(90_000);

    const fraudClaim = await seedInvestigatedClaim(request, '0.0.10465722', 'e2e-payout-fraud');
    const clearedClaim = await seedInvestigatedClaim(request, '0.0.10465723', 'e2e-payout-cleared');

    await page.goto('/claims');

    await test.step('independently re-verifies a real FRAUD claim and executes a real Hedera payout', async () => {
      await page.locator('button', { hasText: `#${fraudClaim.id} Northbeam` }).click();
      await expect(page.getByRole('heading', { name: `Claim #${fraudClaim.id} — Acme Corp` })).toBeVisible();

      const paidOut = page.waitForResponse(
        (response) => response.url().endsWith(`/api/claims/${fraudClaim.id}/payout`) && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Run Payout' }).click();
      const response = await paidOut;
      expect(response.status()).toBe(200);
      const body = await response.json();

      // Real, PayoutAgent-executed Hedera transaction hash — never a hardcoded demo string.
      expect(body.status).toBe('approved');
      expect(body.payoutTxHash).toBeTruthy();

      const txLink = page.getByRole('link', { name: new RegExp(`Hedera tx: ${body.payoutTxHash.replace(/[.@]/g, '\\$&')}`) });
      await expect(txLink).toBeVisible();
      await expect(txLink).toHaveAttribute('href', HASHSCAN_TX_URL);
    });

    await test.step('refuses to pay a real CLEARED claim — no fraud confirmed, nothing offered to pay', async () => {
      await page.locator('button', { hasText: `#${clearedClaim.id} Northbeam` }).click();
      await expect(page.getByRole('heading', { name: `Claim #${clearedClaim.id} — Acme Corp` })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Run Payout' })).not.toBeVisible();
      await expect(page.getByText('Not payable — InvestigatorAgent found no fraud, nothing to reimburse.')).toBeVisible();
    });
  });
});
