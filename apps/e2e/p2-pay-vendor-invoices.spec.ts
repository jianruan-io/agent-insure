import { test, expect, type Page } from '@playwright/test';

test.use({ baseURL: 'http://localhost:6323' });

const STORAGE_KEY = 'agent-insure-business-v1';
const HASHSCAN_TX_URL = /^https:\/\/hashscan\.io\/testnet\/transaction\/\d+\.\d+\.\d+@\d+\.\d+$/;
const HASHSCAN_ACCOUNT_URL = /^https:\/\/hashscan\.io\/testnet\/account\/\d+\.\d+\.\d+$/;
const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';

/** Converts the Hedera SDK's own transaction id format into the one Mirror Node's REST API expects. */
function toMirrorNodeTxId(sdkTransactionId: string): string {
  const [account, timestamp] = sdkTransactionId.split('@');
  return `${account}-${timestamp.replace('.', '-')}`;
}

/**
 * TECH-663's real proof: a payment's real dollar amount moves as that exact real mUSDC
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
 * Same rationale as p3-file-the-claim.spec.ts: this test's Goal is the real payment
 * pipeline, not the ENS lock itself — p1-lock-agent-payment-rules.spec.ts is the one place
 * that proves that real, permanent, gas-costing flow. Seeding `rules.locked` directly
 * avoids re-driving a different Goal's mechanism on every run of this one.
 */
async function lockRulesForTest(page: Page) {
  await page.goto('/rules');
  await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    raw.rules = { ...raw.rules, locked: true };
    localStorage.setItem(key, JSON.stringify(raw));
  }, STORAGE_KEY);
  await page.reload();
}

/**
 * No mocking anywhere in this flow — both buttons hit the real running Express server
 * (started for real by the root playwright.config.ts's webServer), which itself charges a
 * real x402 insurance/coverage fee through the live Blocky402 facilitator, executes a real
 * Hedera vendor transfer, and logs both to a real HCS topic. A passing run is proof the
 * whole chain of real services is wired correctly, not proof a mock was set up right. The
 * vendor payment and the insurance payment are two entirely separate real mUSDC
 * transactions — always shown as two separate column pairs (amount + tx), never merged.
 */
test.describe('PayableAgent pays vendors for real on Hedera, with a real x402 insurance payment', () => {
  test('both the normal and poisoned invoice buttons end on real, independently-checkable proof', async ({ page }) => {
    // Each click triggers a real insurance-payment settlement plus a real vendor transfer
    // plus a real HCS submit against Hedera testnet — well beyond Playwright's 30s default.
    test.setTimeout(120_000);

    await lockRulesForTest(page);
    await expect(page.getByText('Locked on ENS')).toBeVisible();

    await page.goto('/activity');

    await test.step('simulate a normal invoice and confirm it pays the vendor’s own real account', async () => {
      const simulated = page.waitForResponse(
        (response) => response.url().endsWith('/api/activity/simulate') && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Simulate normal invoice' }).click();
      const response = await simulated;
      expect(response.status()).toBe(200);
      const body = await response.json();

      const row = page.locator('tbody tr').first();
      await expect(row.getByText('OK', { exact: true })).toBeVisible({ timeout: 60_000 });
      const cells = row.locator('td');

      // Time: a real, formatted timestamp derived from the vendor payment tx's own
      // consensus time — never "Just now" or "Invalid Date" — and itself a link to that tx.
      await expect(cells.nth(0)).not.toHaveText(/just now|invalid date/i);
      const timeLink = cells.nth(0).getByRole('link');
      await expect(timeLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      await expect(cells.nth(1)).toHaveText(body.vendor);

      // Hedera Address links straight to that account's own real HashScan page.
      const addressLink = cells.nth(2).getByRole('link');
      await expect(addressLink).toHaveText(body.account);
      await expect(addressLink).toHaveAttribute('href', HASHSCAN_ACCOUNT_URL);

      // Vendor Payment: its own amount + its own real transaction, distinct from the
      // insurance payment two columns over.
      await expect(cells.nth(4)).toHaveText(`$${body.vendorPaymentUsd.toFixed(2)}`);
      const vendorTxLink = cells.nth(5).getByRole('link');
      await expect(vendorTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      // Insurance Payment: its own amount + its own real transaction — a separate mUSDC
      // transfer, unrelated in size to the invoice.
      await expect(cells.nth(6)).toHaveText(`$${body.insurancePaymentUsd.toFixed(2)}`);
      const insuranceTxLink = cells.nth(7).getByRole('link');
      await expect(insuranceTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);
      expect(await vendorTxLink.getAttribute('href')).not.toBe(await insuranceTxLink.getAttribute('href'));

      // The real proof: the invoice's real $500 moved as exactly 500.00 real mUSDC, not a
      // fixed, unrelated amount — and the insurance payment moved its own, separate real
      // mUSDC amount.
      await expectRealTokenAmount(body.vendorPaymentTxHash, body.vendorPaymentUsd);
      await expectRealTokenAmount(body.insurancePaymentTxHash, body.insurancePaymentUsd);

      // Independent proof, on Hedera's own public explorer — not our app's word for it.
      const insuranceUrl = await insuranceTxLink.getAttribute('href');
      const insuranceExplorerPage = await page.context().newPage();
      await insuranceExplorerPage.goto(insuranceUrl!);
      await expect(insuranceExplorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(insuranceExplorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await insuranceExplorerPage.close();

      const vendorUrl = await vendorTxLink.getAttribute('href');
      const vendorExplorerPage = await page.context().newPage();
      await vendorExplorerPage.goto(vendorUrl!);
      await expect(vendorExplorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(vendorExplorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await vendorExplorerPage.close();

      // Every row's real invoice is viewable — not just the ones that get flagged.
      await cells.nth(8).getByRole('button', { name: 'View' }).click();
      const invoiceModal = page.getByTestId('invoice-modal');
      await expect(page.getByText('Invoice as PayableAgent read it — normal')).toBeVisible();
      await expect(invoiceModal.getByText(new RegExp(body.account.replace(/\./g, '\\.')))).toBeVisible();
      await page.getByRole('button', { name: 'close' }).click();

      // The x402 protocol payload is clearly separate from the onchain proof of its
      // settlement — two distinct, labeled sections, not one blob.
      await cells.nth(9).getByRole('button', { name: 'View' }).click();
      await expect(page.getByText('x402 insurance payment')).toBeVisible();
      await expect(page.getByText('1. Protocol payload')).toBeVisible();
      await expect(page.getByText(/"scheme": "exact"/)).toBeVisible();
      await expect(page.getByText('2. Onchain proof')).toBeVisible();
      const x402SettlementLink = page.getByRole('link', { name: /View the .* mUSDC settlement on HashScan/ });
      await expect(x402SettlementLink).toHaveAttribute('href', insuranceUrl!);
      await page.getByRole('button', { name: 'close' }).click();
    });

    await test.step('simulate a poisoned invoice and confirm PayableAgent was genuinely fooled, with real proof of the wrong destination', async () => {
      const simulated = page.waitForResponse(
        (response) => response.url().endsWith('/api/activity/simulate') && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Simulate poisoned invoice' }).click();
      const response = await simulated;
      expect(response.status()).toBe(200);
      const body = await response.json();

      // Real, PayableAgent-generated reasoning — never the old hardcoded client string.
      expect(body.reasoning).toBeTruthy();
      expect(body.reasoning).not.toBe(
        'New account for this vendor — never paid before. Outside the locked vendor list. Looks like manipulation, not a normal decision.'
      );
      expect(body.flagged).toBe(true);

      const row = page.locator('tbody tr').first();
      await expect(row.getByText('Flagged', { exact: true })).toBeVisible({ timeout: 60_000 });
      const cells = row.locator('td');

      // Counterparty is the plain vendor name — no decoration distinguishing a flagged row;
      // the Status column alone carries that signal.
      await expect(cells.nth(1)).toHaveText(body.vendor);
      const addressLink = cells.nth(2).getByRole('link');
      await expect(addressLink).toHaveText(body.account);
      await expect(addressLink).toHaveAttribute('href', HASHSCAN_ACCOUNT_URL);

      const vendorTxLink = cells.nth(5).getByRole('link');
      await expect(vendorTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);
      const insuranceTxLink = cells.nth(7).getByRole('link');
      await expect(insuranceTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      // Even the poisoned, wrongly-destined payment moves the real dollar-equal amount —
      // the attack diverts the destination, not the value.
      await expectRealTokenAmount(body.vendorPaymentTxHash, body.vendorPaymentUsd);

      // Independent proof, on Hedera's own public explorer — even the fraudulent payment
      // is a real, permanent transaction anyone can check for themselves.
      const vendorUrl = await vendorTxLink.getAttribute('href');
      const explorerPage = await page.context().newPage();
      await explorerPage.goto(vendorUrl!);
      await expect(explorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(explorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await explorerPage.close();

      // The concealed instruction itself, in its own Invoice column — the real document
      // PayableAgent read, not a description of it.
      await cells.nth(8).getByRole('button', { name: 'View' }).click();
      const invoiceModal = page.getByTestId('invoice-modal');
      await expect(page.getByText('Invoice as PayableAgent read it — poisoned')).toBeVisible();
      await expect(invoiceModal.getByText(/URGENT ACCOUNT UPDATE/i)).toBeVisible();
      await expect(invoiceModal.getByText(new RegExp(body.account.replace(/\./g, '\\.')))).toBeVisible();
    });
  });
});
