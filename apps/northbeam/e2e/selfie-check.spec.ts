import { test, expect, type Page } from '@playwright/test';

const VALID_REQUEST_RESPONSE = {
  app_id: 'app_test1234567890',
  action: 'file-claim',
  environment: 'sandbox',
  rp_context: {
    rp_id: 'rp_test',
    nonce: '0x' + '1'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 300,
    signature: '0x' + '2'.repeat(130),
  },
};

/**
 * Drives a fresh claim into "awaiting identity" — lock the rules, simulate the poisoned
 * invoice, file the claim — the same three steps a person would take before ever seeing
 * the Selfie Check modal. Each test gets its own isolated browser context (no shared
 * localStorage), so this always starts from the seed state.
 */
async function fileAClaim(page: Page) {
  await page.goto('/rules');
  await page.getByRole('button', { name: 'Lock Rules On-Chain' }).click();

  await page.goto('/activity');
  await page.getByRole('button', { name: 'Simulate poisoned invoice' }).click();

  await page.goto('/claims');
  await page.getByRole('button', { name: /File a Claim/i }).click();
}

test.describe('Guardian completes the identity check', () => {
  test.beforeEach(async ({ page }) => {
    // The IDKit widget may try to reach World's real connect servers with the fake
    // signature this test supplies — neutralize those so the test stays deterministic
    // and doesn't depend on a live external service's response to bogus credentials.
    await page.route('**://*.worldcoin.org/**', (route) => route.abort());
    await page.route('**://*.world.org/**', (route) => route.abort());
  });

  test('clicking "Start face scan" opens the real World connect flow instead of the old fake timer', async ({
    page,
  }) => {
    await page.route('**/api/world/request', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VALID_REQUEST_RESPONSE) })
    );

    await fileAClaim(page);
    await page.getByRole('button', { name: 'Start face scan' }).click();

    await expect(page.getByText('Scanning face… hold still')).toHaveCount(0);
    await expect(page.getByText('Scan the code with the World app to continue.')).toBeVisible();
  });

  test('when the identity check can\'t start, a real error is shown and the claim stays "awaiting identity"', async ({
    page,
  }) => {
    await page.route('**/api/world/request', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error:
            "World ID is not configured yet — missing app_id, rp_id, signing key, or action (waiting on the Selfie Check feature flag).",
        }),
      })
    );

    await fileAClaim(page);
    await page.getByRole('button', { name: 'Start face scan' }).click();

    await expect(page.getByText(/not configured yet/i)).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // Never falls back to fake success — the claim is still waiting on a real check.
    await expect(page.getByRole('button', { name: 'Start face scan' })).toBeVisible();
  });
});

// Not automated: completing the check itself requires a real World ID app/device
// completing a live (or Sandbox-simulated) scan — there is no way to trigger IDKit's
// internal success callback from outside the widget without one. Verify by hand once
// TECH-604's feature flag is approved: file a claim, scan with the World ID Sandbox app,
// and confirm the claim moves from "awaiting identity" to "submitted".
