import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:6324' });

const API_URL = 'http://localhost:8787';
const NORTHBEAM_URL = 'http://localhost:6323';
const HASHSCAN_TX_URL = /^https:\/\/hashscan\.io\/testnet\/transaction\/\d+\.\d+\.\d+@\d+\.\d+$/;
const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';
const STORAGE_KEY = 'agent-insure-business-v1';

/** Converts the Hedera SDK's own transaction id format into the one Mirror Node's REST API expects. */
function toMirrorNodeTxId(sdkTransactionId: string): string {
  const [account, timestamp] = sdkTransactionId.split('@');
  return `${account}-${timestamp.replace('.', '-')}`;
}

/**
 * TECH-663's real proof: the claim's real dollar amount now moves as that exact real mUSDC
 * amount, not a fixed figure decoupled from what's on screen. Reads straight from Hedera
 * Mirror Node — retried briefly since indexing lags consensus by a couple of seconds.
 */
async function expectRealTokenAmount(sdkTransactionId: string, expectedDollarAmount: number) {
  const expectedSmallestUnits = Math.round(expectedDollarAmount * 100);
  const mirrorNodeId = toMirrorNodeTxId(sdkTransactionId);
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(`${MIRROR_NODE_URL}/api/v1/transactions/${mirrorNodeId}`);
    if (response.ok) {
      const body = await response.json();
      const transfer = body.transactions?.[0]?.token_transfers?.find((t: { amount: number }) => t.amount === expectedSmallestUnits);
      if (transfer) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Mirror Node never showed a real ${expectedDollarAmount}-dollar-equal mUSDC transfer for ${sdkTransactionId}`);
}

/**
 * Seeds a real disputed claim directly and investigates it for real — the precondition this
 * Goal needs (a signed verdict), not the thing under test. p4-investigate-claim.spec.ts
 * already proves InvestigatorAgent's verdict live.
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
 * Seeds a real, already-investigated claim directly against the server, then injects a
 * matching, already-`submitted` ClaimEntry into Northbeam's own local state. Filing a claim
 * and completing its selfie check are different Goals, already proven for real in
 * p3-file-the-claim.spec.ts — re-driving that whole (expensive, multi-minute) flow here
 * would test that Goal again, not this one: whether Northbeam's own portal notices a real
 * payout once it happens. A separate claim from the one PayoutAgent pays out below, so
 * Northbeam can be watched flipping live from Submitted to Approved rather than loading
 * already-resolved.
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
 * No mocking anywhere in this flow — Run Payout and Northbeam's own polling both hit the
 * real running Express server, which itself independently re-derives the verdict against
 * real Hedera Mirror Node history and real ENS-locked rules, checks the reserve pool's real
 * live balance, and executes a real Hedera transfer. A passing run is proof PayoutAgent's
 * own judgment, the money movement, and Northbeam noticing it are all real, not proof a
 * mock was set up right.
 */
test.describe('PayoutAgent independently verifies the verdict and executes a real Hedera payout, then Northbeam notices it', () => {
  test('pays out a real FRAUD claim on Hedera, refuses a CLEARED one, and Northbeam sees the real payout resolve live', async ({
    page,
    request,
  }) => {
    // Two real payouts (each re-running the full Mirror Node + ENS investigation plus a
    // real Hedera transfer and HCS log) plus Northbeam's 3s poll cycle — well beyond
    // Playwright's 30s default.
    test.setTimeout(150_000);

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

      const txLink = page.getByRole('link', { name: new RegExp(`Hedera tx \\(.*\\): ${body.payoutTxHash.replace(/[.@]/g, '\\$&')}`) });
      await expect(txLink).toBeVisible();
      await expect(txLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      // The real proof: the claim's real $500 was reimbursed as exactly 500.00 real mUSDC,
      // not a fixed, unrelated amount.
      await expectRealTokenAmount(body.payoutTxHash, fraudClaim.amount);

      // Independent proof, on Hedera's own public explorer — not our app's word for it.
      const payoutUrl = await txLink.getAttribute('href');
      const explorerPage = await page.context().newPage();
      await explorerPage.goto(payoutUrl!);
      await expect(explorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(explorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await explorerPage.close();
    });

    await test.step('refuses to pay a real CLEARED claim — no fraud confirmed, nothing offered to pay', async () => {
      await page.locator('button', { hasText: `#${clearedClaim.id} Northbeam` }).click();
      await expect(page.getByRole('heading', { name: `Claim #${clearedClaim.id} — Acme Corp` })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Run Payout' })).not.toBeVisible();
      await expect(page.getByText('Not payable — InvestigatorAgent found no fraud, nothing to reimburse.')).toBeVisible();
    });

    await test.step("Northbeam's portal notices the real payout and shows it resolved", async () => {
      const claimId = await seedSubmittedClaim(request);

      await page.goto(`${NORTHBEAM_URL}/claims`); // first load seeds localStorage via the store's own seedState()
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
        name: new RegExp(`Hedera tx \\(.*\\): ${payout.payoutTxHash.replace(/[.@]/g, '\\$&')}`),
      });
      await expect(txLink).toBeVisible();
      await expect(txLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      // Independent proof, on Hedera's own public explorer — not Agent Insure's word for it.
      const payoutUrl = await txLink.getAttribute('href');
      const explorerPage = await page.context().newPage();
      await explorerPage.goto(payoutUrl!);
      await expect(explorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(explorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await explorerPage.close();
    });
  });
});
