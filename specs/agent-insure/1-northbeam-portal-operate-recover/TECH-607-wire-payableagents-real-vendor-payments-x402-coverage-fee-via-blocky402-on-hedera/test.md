# Test Plan · Wire PayableAgent's real vendor payments + x402 coverage fee via Blocky402 on Hedera

**Layer:** TS Unit (Backend, `server/`)

**File:** `server/src/hedera/__tests__/coverage-fee.test.js`, `server/src/routes/__tests__/activity.test.js`

**Run:** `npx vitest run` (from `server/`)

---

## Tests

**coverage-fee.js**

- **buildCoverageFeeRequirements** — [unit] builds the 402 payment-required body from the fee amount, the reserve pool's account, and the USDC asset id
  - [happy-path] given a fee amount and the reserve pool account, produces a well-formed Blocky402-compatible payment-requirements object (scheme, network `"hedera:testnet"`, asset, payTo, amount)
  - [boundary] a zero or missing fee amount is rejected, not silently charged as free

- **hasValidPaymentHeader** — [unit] detects whether an incoming request already carries a payment proof
  - [happy-path] a request with a well-formed `X-PAYMENT` header is detected as carrying payment
  - [unhappy-path] a request with no `X-PAYMENT` header, or a malformed one, is detected as not carrying payment (triggers the 402 challenge, never treated as paid)

**activity.js**

- **selectPoisonedPaymentTarget** — [unit] the poisoned path's hardcoded wrong-account selection
  - [happy-path] given the locked vendor and the configured wrong account, returns a payment intent to the wrong account, never the vendor's real locked account

- **buildActivityRow** — [unit] turns real Hedera receipts into the row the frontend receives
  - [happy-path] given a fee receipt, a payment receipt, and an HCS sequence number, produces a row with the real amount, fee, and both transaction hashes — never a placeholder or invented value
  - [boundary] a receipt missing a transaction hash raises rather than producing a row with a blank hash the UI would silently accept

- **classifyPaymentError** — [unit] maps a raw failure to one of Core Logic's two named error states
  - [happy-path] a failure raised during the coverage-fee charge classifies as the "fee charge failed, nothing paid" state (ERR1)
  - [happy-path] a failure raised during the vendor transfer classifies as the "fee already paid, vendor payment failed" state (ERR2)
  - [unhappy-path] an unrecognized error shape falls back to a generic failure state, never throws

---

## Not covered here

The real Claude call (PayableAgent's actual payment decision for the "normal" path), the real Blocky402 verify/settle round-trip, the real Hedera transfers, and the real HCS log are proved for real — no mocks — by this spec's own Playwright Action Item (`apps/business/e2e/agent-pays-vendors.spec.ts`) and by each Action Item's own curl/CLI verify command, matching this repo's `/e2e-verify` convention and its explicit rule against mocking either Claude-call agent's judgment.
