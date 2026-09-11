# Test Plan · Wire PayoutAgent to real verdict verification and real Hedera payout execution

**Layer:** BE unit (vitest)

**File:** `server/src/routes/__tests__/claims.test.js`

**Run:** `npm test --prefix server -- claims`

**Note:** Same pattern as TECH-612 — consolidated into the existing `claims.test.js`, importing pure/storage functions from `mirror-node.js`, `payout/authorize-payout.js`, and `claims.js` rather than one file per module. `fetch` is mocked at module level. The real Hedera transfer execution, the reserve-pool client helpers, and the full `POST /api/claims/:id/payout` route orchestration are not unit tested here — same as TECH-612 never unit tested the investigate route or TECH-608 never unit tested `executeVendorTransfer` — they're proven live via the Action Item 5 curl verify and the e2e proof instead.

---

## Tests

**mirror-node.js**

- **fetchAccountBalance** *(real Mirror Node account-balance REST call — `fetch` mocked at module level)*
  - [happy-path] returns the real, live HBAR balance for the given account, parsed from the Mirror Node response
  - [unhappy-path] raises a real, distinct error when the Mirror Node request itself fails

**payout/authorize-payout.js**

- **authorizePayout**
  - [happy-path] authorizes payout when the re-derived verdict and reasoning match the stored verdict, the verdict is `FRAUD`, and the claim isn't already paid
  - [unhappy-path] raises a real, distinct error when the re-derived verdict or reasoning doesn't match the stored verdict
  - [unhappy-path] raises a real, distinct error when the verdict is `CLEARED` (nothing to pay)
  - [unhappy-path] raises a real, distinct error when the claim's status is already `approved` (already paid)

**claims.js**

- **recordPayout** *(new, extends the existing claims store)*
  - [happy-path] updates the stored claim with the real payout transaction hash and marks status `approved`
