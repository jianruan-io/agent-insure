import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:8787';
const STORAGE_KEY = 'agent-insure-business-v1';
const HASHSCAN_TX_URL = /^https:\/\/hashscan\.io\/testnet\/transaction\/\d+\.\d+\.\d+@\d+\.\d+$/;

/**
 * Seeds a real, already-investigated claim directly against the server, then injects a
 * matching, already-`submitted` ClaimEntry into Northbeam's own local state. Filing a claim
 * and completing its selfie check are different Goals, already proven for real in
 * claim-filing.spec.ts and selfie-check.spec.ts — re-driving that whole (expensive,
 * multi-minute) flow here would test those Goals again, not this one: whether Northbeam's
 * own portal notices a real payout once it happens.
 */
async function seedSubmittedClaim(request: import('@playwright/test').APIRequestContext) {
  const created = await request.post(`${API_URL}/api/claims`, {
    data: { vendor: 'Acme Corp', amount: 500, activityId: 'e2e-payout-confirmed', account: '0.0.10465722' },
  });
  expect(created.status()).toBe(201);
  const claim = await created.json();

  const investigated = await request.post(`${API_URL}/api/claims/${claim.id}/investigate`);
  expect(investigated.status()).toBe(200);
  const body = await investigated.json();
  expect(body.verdict).toBe('FRAUD');

  return claim.id as string;
}

/**
 * No mocking anywhere in this flow — Northbeam's own polling hits the real running Express
 * server, which itself reflects a real Hedera transfer PayoutAgent actually executed. A
 * passing run is proof Northbeam genuinely notices real money moving, not proof a mock was
 * set up right.
 */
test.describe("Northbeam's portal notices a real payout and shows it resolved", () => {
  test('a claim flips from Submitted to Approved, with the real transaction linked to HashScan, once Agent Insure actually pays it', async ({
    page,
    request,
  }) => {
    // Northbeam polls every 3s; the payout itself is a real Hedera transfer + HCS log.
    test.setTimeout(60_000);

    const claimId = await seedSubmittedClaim(request);

    await test.step("polls the real claim record and shows it resolved once Agent Insure actually pays it", async () => {
      await page.goto('/claims'); // first load seeds localStorage via the store's own seedState()
      await page.evaluate(
        ({ key, claimId }) => {
          const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
          raw.claims = [
            ...(raw.claims ?? []),
            {
              id: claimId,
              vendor: 'Acme Corp',
              amount: 500,
              time: 'Just now',
              seed: false,
              status: 'submitted',
              reasoning: 'Does not match the locked vendor list.',
              payoutTxHash: null,
            },
          ];
          localStorage.setItem(key, JSON.stringify(raw));
        },
        { key: STORAGE_KEY, claimId }
      );
      await page.reload();

      await expect(page.getByText('Submitted — now with Agent Insure for investigation')).toBeVisible();

      // Agent Insure actually pays the claim for real, independently of anything Northbeam's
      // UI does — exactly what would happen if a different company resolved it.
      const paidOut = await request.post(`${API_URL}/api/claims/${claimId}/payout`);
      expect(paidOut.status()).toBe(200);
      const payout = await paidOut.json();
      expect(payout.payoutTxHash).toBeTruthy();

      // Real proof rendering live, picked up by Northbeam's own polling — not a page reload.
      await expect(page.getByText('Approved — $500 returned')).toBeVisible({ timeout: 15_000 });
      const txLink = page.getByRole('link', {
        name: new RegExp(`Hedera tx: ${payout.payoutTxHash.replace(/[.@]/g, '\\$&')}`),
      });
      await expect(txLink).toBeVisible();
      await expect(txLink).toHaveAttribute('href', HASHSCAN_TX_URL);
    });
  });
});
