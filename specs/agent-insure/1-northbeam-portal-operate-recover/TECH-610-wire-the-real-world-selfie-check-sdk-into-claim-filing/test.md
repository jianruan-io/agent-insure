# Test Plan · Wire the real World Selfie Check SDK into claim filing

**Layer:** Integration (backend routes, vitest) + E2E (Playwright, full UI flow — automated with trace capture per explicit instruction; this project's default E2E convention is manual-only, overridden here on purpose)

**File:**
- `server/src/routes/__tests__/world.test.ts` (Integration)
- `apps/northbeam/e2e/selfie-check.spec.ts` (E2E)

**Run:**
- `cd server && npx vitest run`
- `cd apps/northbeam && npx playwright test` — trace always captured (`trace: 'on'` in `playwright.config.ts`), view any run with `npx playwright show-trace <path-to-trace.zip>`

---

## Tests

**world routes**

- **POST /api/world/request**
  - [happy-path] a signed connect request is created for a valid claim id
  - [unhappy-path] a clear error is returned when the signing key isn't configured yet (flag not enabled)
  - [unhappy-path] a clear error is returned when World's own request/sign step fails

- **POST /api/world/verify**
  - [happy-path] a valid, unused proof is confirmed as verified
  - [unhappy-path] an invalid or expired proof is rejected, not silently accepted
  - [unhappy-path] a proof that has already been used once is rejected
  - [unhappy-path] a clear error is returned when World's verify endpoint itself fails or is unreachable

**Claim filing UI** (Playwright E2E, network-mocked at the World/backend boundary, trace captured)

- **Guardian completes the identity check**
  - [happy-path] clicking "Start face scan" calls the real backend instead of running the old fake timer — **automated.** Deviation from the original plan: asserts the backend was actually called + the fake timer text is gone, not that the widget's own "ready" UI renders — see below.
  - [unhappy-path] when the check can't start, a real error is shown and the claim stays "awaiting identity" — it never falls back to fake success like the removed mock did — **automated**
  - [happy-path] once the backend confirms verification, the claim moves from "awaiting identity" to "submitted" — **not automated, deviation:** completing the check requires a real World ID app/device finishing a live (or Sandbox-simulated) scan; there is no way to trigger IDKit's internal success callback from outside the widget without one.

**Discovered while building, not anticipated in the original plan:** `@worldcoin/idkit`'s `IDKitRequestWidget` does real local (WASM) validation of `app_id`/`rp_id`/signature format and rejects synthetic test data as `generic_error` before rendering anything — confirmed by hand while diagnosing an unexpectedly-failing manual repro. So the widget's actual "ready" UI (QR/connect screen) cannot be shown by an automated test without a real Developer Portal app, not just a live device. Both that and the "moves to submitted" case are documented as manual checks (comment at the bottom of `selfie-check.spec.ts`), to run once TECH-604's flag is approved.
