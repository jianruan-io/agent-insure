import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'agent-insure-business-v1';
const HASHSCAN_TX_URL = /^https:\/\/hashscan\.io\/testnet\/transaction\/\d+\.\d+\.\d+@\d+\.\d+$/;

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

      const row = page.locator('tbody tr').first();
      await expect(row.getByText('OK', { exact: true })).toBeVisible({ timeout: 60_000 });

      const feeLink = row.getByRole('link', { name: /ℏ$/ });
      await expect(feeLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      await row.getByRole('button', { name: 'reason' }).click();
      const reasoningRow = row.locator('xpath=following-sibling::tr[1]');
      const paymentTxLink = reasoningRow.getByRole('link', { name: /^vendor payment tx:/ });
      await expect(paymentTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);
      await expect(reasoningRow.getByText(/logged to Hedera Consensus Service · seq #\d+/)).toBeVisible();
    });

    await test.step('simulate a poisoned invoice and confirm it is flagged with real proof of the wrong destination', async () => {
      const simulated = page.waitForResponse(
        (response) => response.url().endsWith('/api/activity/simulate') && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Simulate poisoned invoice' }).click();
      const response = await simulated;
      expect(response.status()).toBe(200);

      const row = page.locator('tbody tr').first();
      await expect(row.getByText('Flagged', { exact: true })).toBeVisible({ timeout: 60_000 });

      const feeLink = row.getByRole('link', { name: /ℏ$/ });
      await expect(feeLink).toHaveAttribute('href', HASHSCAN_TX_URL);

      await row.getByRole('button', { name: 'reason' }).click();
      const reasoningRow = row.locator('xpath=following-sibling::tr[1]');
      const paymentTxLink = reasoningRow.getByRole('link', { name: /^vendor payment tx:/ });
      await expect(paymentTxLink).toHaveAttribute('href', HASHSCAN_TX_URL);
      await expect(reasoningRow.getByText(/logged to Hedera Consensus Service · seq #\d+/)).toBeVisible();
    });
  });
});
