import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'agent-insure-business-v1';
const HASHSCAN_TX_URL = /^https:\/\/hashscan\.io\/testnet\/transaction\/\d+\.\d+\.\d+@\d+\.\d+$/;
const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';

/** Converts the Hedera SDK's own transaction id format into the one Mirror Node's REST API expects. */
function toMirrorNodeTxId(sdkTransactionId: string): string {
  const [account, timestamp] = sdkTransactionId.split('@');
  return `${account}-${timestamp.replace('.', '-')}`;
}

/**
 * TECH-663's real proof: the invoice's real dollar amount now moves as that exact real
 * mUSDC amount, not a fixed figure decoupled from what's on screen. Reads straight from
 * Hedera Mirror Node — retried briefly since indexing lags consensus by a couple of seconds.
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
 * Same rationale as claim-filing.spec.ts: this test's Goal is the real payment pipeline,
 * not the ENS lock itself — TECH-606's lock-rules.spec.ts is the one place that proves
 * that real, permanent, gas-costing flow. Seeding `rules.locked` directly avoids re-driving
 * a different Goal's mechanism on every run of this one.
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
 * (started for real by playwright.config.ts's webServer), which itself charges a real
 * x402 coverage fee through the live Blocky402 facilitator, executes a real Hedera
 * testnet transfer, and logs both to a real HCS topic. A passing run is proof the whole
 * chain of real services is wired correctly, not proof a mock was set up right.
 */
test.describe('PayableAgent pays vendors for real on Hedera, with a real x402 coverage fee', () => {
  test('both the normal and poisoned invoice buttons end on real, independently-checkable proof', async ({ page }) => {
    // Each click triggers a real coverage-fee settlement plus a real vendor transfer plus
    // a real HCS submit against Hedera testnet — well beyond Playwright's 30s default.
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

      const feeLink = row.getByRole('link', { name: /ℏ$/ });
      await expect(feeLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      await row.getByRole('button', { name: 'reason' }).click();
      const reasoningRow = row.locator('xpath=following-sibling::tr[1]');
      const paymentTxLink = reasoningRow.getByRole('link', { name: /^vendor payment tx \(/ });
      await expect(paymentTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);
      await expect(reasoningRow.getByText(/logged to Hedera Consensus Service · seq #\d+/)).toBeVisible();

      // The real proof: the invoice's real $500 moved as exactly 500.00 real mUSDC, not a
      // fixed, unrelated amount.
      await expectRealTokenAmount(body.paymentTxHash, body.amount);

      // Independent proof, on Hedera's own public explorer — not our app's word for it.
      const feeUrl = await feeLink.getAttribute('href');
      const feeExplorerPage = await page.context().newPage();
      await feeExplorerPage.goto(feeUrl!);
      await expect(feeExplorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(feeExplorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await feeExplorerPage.close();

      const paymentUrl = await paymentTxLink.getAttribute('href');
      const paymentExplorerPage = await page.context().newPage();
      await paymentExplorerPage.goto(paymentUrl!);
      await expect(paymentExplorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(paymentExplorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await paymentExplorerPage.close();
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

      const feeLink = row.getByRole('link', { name: /ℏ$/ });
      await expect(feeLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      await row.getByRole('button', { name: 'reason' }).click();
      const reasoningRow = row.locator('xpath=following-sibling::tr[1]');
      await expect(reasoningRow.getByText(body.reasoning)).toBeVisible();

      const paymentTxLink = reasoningRow.getByRole('link', { name: /^vendor payment tx \(/ });
      await expect(paymentTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);
      await expect(reasoningRow.getByText(/logged to Hedera Consensus Service · seq #\d+/)).toBeVisible();

      // Even the poisoned, wrongly-destined payment moves the real dollar-equal amount —
      // the attack diverts the destination, not the value.
      await expectRealTokenAmount(body.paymentTxHash, body.amount);

      // Independent proof, on Hedera's own public explorer — even the fraudulent payment
      // is a real, permanent transaction anyone can check for themselves.
      const paymentUrl = await paymentTxLink.getAttribute('href');
      const explorerPage = await page.context().newPage();
      await explorerPage.goto(paymentUrl!);
      await expect(explorerPage.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
      await expect(explorerPage.getByText('CRYPTO TRANSFER')).toBeVisible();
      await explorerPage.close();

      // The concealed instruction itself, on screen — the real document PayableAgent read,
      // not a description of it.
      await reasoningRow.getByRole('button', { name: 'View invoice' }).click();
      const invoiceModal = page.getByTestId('invoice-modal');
      await expect(invoiceModal.getByText('Invoice as PayableAgent read it')).toBeVisible();
      await expect(invoiceModal.getByText(/URGENT ACCOUNT UPDATE/i)).toBeVisible();
      await expect(invoiceModal.getByText(new RegExp(body.account.replace(/\./g, '\\.')))).toBeVisible();
    });
  });
});
