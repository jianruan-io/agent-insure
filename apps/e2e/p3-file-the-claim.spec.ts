import { test, expect, type Page } from '@playwright/test';
import { signRequest } from '@worldcoin/idkit-core/signing';

test.use({ baseURL: 'http://localhost:6323' });

const STORAGE_KEY = 'agent-insure-business-v1';

/**
 * Seeds `rules.locked` directly in localStorage instead of driving the real ENS
 * write-then-lock flow through the UI. This test's Goal is claim filing and the identity
 * check, not the ENS lock itself — p1-lock-agent-payment-rules.spec.ts is the one place
 * that proves the real on-chain lock, with no mocking of the chain interaction. Re-driving
 * that same real, permanent, gas-costing flow here on every run would be slow and would
 * re-test a different Goal's mechanism, not this one.
 */
async function lockRulesForTest(page: Page) {
  await page.goto('/rules'); // first load seeds localStorage via the store's own seedState()
  await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    raw.rules = { ...raw.rules, locked: true };
    localStorage.setItem(key, JSON.stringify(raw));
  }, STORAGE_KEY);
  await page.reload();
}

/**
 * No mocking here, on either side — unlike the identity-check tests below, which mock the
 * World boundary deliberately. `POST /api/claims` hits the real Express server (started for
 * real by the root playwright.config.ts's webServer), so a passing run is proof the wiring
 * works, not proof a mock was set up correctly.
 */
test.describe('AP controller files a claim against a real backend record', () => {
  test('filing a claim creates a real backend record and renders it with the server-issued id', async ({ page }) => {
    // TECH-607 made the poisoned-invoice simulation a real Hedera + x402 payment round
    // trip, not an instant client-side dispatch — well beyond Playwright's 30s default.
    test.setTimeout(90_000);

    await test.step('spending rules are already locked', async () => {
      await lockRulesForTest(page);
      await expect(page.getByText('Locked on ENS')).toBeVisible();
    });

    await test.step('simulate the poisoned invoice that gets flagged', async () => {
      await page.goto('/activity');
      await page.getByRole('button', { name: 'Simulate poisoned invoice' }).click();
      await expect(page.getByText('Flagged', { exact: true })).toBeVisible({ timeout: 60_000 });
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
  await lockRulesForTest(page);

  await page.goto('/activity');
  await page.getByRole('button', { name: 'Simulate poisoned invoice' }).click();
  // TECH-607 made this a real Hedera + x402 payment round trip, not an instant
  // client-side dispatch — wait for the real flagged row before moving on.
  await expect(page.getByText('Flagged', { exact: true })).toBeVisible({ timeout: 60_000 });

  await page.goto('/claims');
  await page.getByRole('button', { name: /File a Claim/i }).click();
}

test.describe('Guardian completes the identity check', () => {
  test.beforeEach(async ({ page }) => {
    // fileAClaim's poisoned-invoice step is a real Hedera + x402 payment round trip, not
    // an instant client-side dispatch — well beyond Playwright's 30s default.
    test.setTimeout(90_000);

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
    // real signal here. (The full live flow — real QR, real scan, real verification —
    // is confirmed working by hand against a real device; see the note at the bottom
    // of this file for why it isn't automated.)
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
          error: 'World ID is not configured yet — missing app_id, rp_id, or signing key.',
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

// Not automated, and not automatable without a real Developer Portal app + a physical
// device: the IDKit widget does real local validation of app_id/rp_id/signature before
// it will render anything, so synthetic test data can't reach a real QR code, and
// completing a scan needs an actual World ID app on an actual phone — neither is
// something Playwright can drive. CONFIRMED WORKING by hand, real device, real
// credentials, 2026-09-08: filed a claim, scanned the real QR with the World ID
// Sandbox app on Android, and the claim moved from "awaiting identity" to "submitted"
// with "Identity verified — Guardian, AP Controller" shown. Uses the `selfieCheckLegacy`
// preset with `allow_legacy_proofs: true` — the newer `CredentialRequest('selfie')` +
// `allow_legacy_proofs: false` combination fails with `world_id_4_not_available` since
// World ID 4.0 isn't available for this Sandbox identity yet.
