import { test, expect, type Page } from '@playwright/test';
import { signRequest } from '@worldcoin/idkit-core/signing';

// A throwaway (not the real registered) but structurally valid secp256k1 key and
// correctly-shaped rp_id — the widget does real client-side format validation, and
// rejects an obviously-fake payload before ever rendering. This is only enough to get
// past that validation; it is not, and cannot be, a real World-issued credential.
const { sig, nonce, createdAt, expiresAt } = signRequest({
  signingKeyHex: '0x' + '7'.repeat(64),
  action: 'file-claim',
});

const VALID_REQUEST_RESPONSE = {
  app_id: 'app_test1234567890',
  action: 'file-claim',
  environment: 'sandbox',
  rp_context: {
    rp_id: 'rp_1234567890abcdef',
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
    signature: sig,
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
    // Defense-in-depth: the widget shouldn't need to reach World's real servers with a
    // fake app_id at all (confirmed — it rejects synthetic data during its own local
    // validation before any network call), but blocking these keeps the test hermetic
    // regardless of that internal behavior.
    await page.route('**://*.worldcoin.org/**', (route) => route.abort());
    await page.route('**://*.world.org/**', (route) => route.abort());
  });

  test('clicking "Start face scan" calls the real backend instead of running the old fake timer', async ({
    page,
  }) => {
    let requestWasCalled = false;
    await page.route('**/api/world/request', (route) => {
      requestWasCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VALID_REQUEST_RESPONSE) });
    });

    await fileAClaim(page);
    await page.getByRole('button', { name: 'Start face scan' }).click();

    // The fake timer never called any backend at all — proving this one did is the
    // real signal here. (What the widget renders once it has genuine World-issued
    // credentials, rather than this test's synthetic ones, can only be confirmed once
    // TECH-604's flag is approved — see the note at the bottom of this file.)
    await expect.poll(() => requestWasCalled).toBe(true);
    await expect(page.getByText('Scanning face… hold still')).toHaveCount(0);
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

// Not automated, and not automatable without a real Developer Portal app: the IDKit
// widget does real local validation of app_id/rp_id/signature before it will render
// anything, and rejects synthetic test data as `generic_error` — confirmed by hand
// while building this. So neither "the widget shows its real ready UI" nor "completing
// the check moves the claim to submitted" can be shown by this test suite. Verify both
// by hand once TECH-604's feature flag is approved: file a claim, scan with the World ID
// Sandbox app, and confirm (a) the real widget UI renders and (b) the claim moves from
// "awaiting identity" to "submitted".
