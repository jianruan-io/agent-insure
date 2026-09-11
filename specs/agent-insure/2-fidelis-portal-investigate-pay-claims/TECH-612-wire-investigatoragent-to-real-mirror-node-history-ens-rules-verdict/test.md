# Test Plan · Wire InvestigatorAgent to real Mirror Node history, ENS rules, and a real verdict

**Layer:** BE unit (vitest)

**File:** `server/src/routes/__tests__/claims.test.js`

**Run:** `npm test --prefix server -- claims`

**Note:** Consolidated into the existing `claims.test.js`, same pattern as TECH-608's `activity.test.js` — imports pure functions from `mirror-node.js`, `read-rules.js`, and `judge-claim.js` rather than one test file per module. `fetch` and viem's public client are mocked at module level; the real network calls themselves are proven live via the Action Item 1/3 curl verify and the e2e proof, not here.

---

## Tests

**mirror-node.js**

- **fetchVendorPaymentHistory** *(real Mirror Node REST call — `fetch` mocked at module level)*
  - [happy-path] decodes real topic-message responses into payment records (vendor, accountId, amount, fee/payment tx hashes)
  - [boundary] returns an empty list when the topic has no messages for this vendor
  - [unhappy-path] raises a real, distinct error when the Mirror Node request itself fails

**read-rules.js**

- **readApprovedAccount** *(real ENS read via viem — public client mocked at module level)*
  - [happy-path] returns the vendor's real locked account read from the ENS text record
  - [unhappy-path] raises a real, distinct error when `ENS_RESOLVER_ADDRESS` is not configured

**judge-claim.js**

- **judgeClaim**
  - [happy-path] returns `CLEARED` with bare-bones reasoning when the disputed account matches the vendor's approved account
  - [happy-path] returns `FRAUD` with bare-bones reasoning when the disputed account differs from the approved account
  - [unhappy-path] raises a real, distinct error when the disputed payment isn't found in history (coverage can't be confirmed)

**claims.js**

- **createClaim** *(existing, extended)*
  - [happy-path] stores and returns a claim carrying the real disputed `account`, alongside vendor/amount/activityId and a draft status
- **listClaims**
  - [happy-path] returns every claim created so far, in creation order
- **recordVerdict**
  - [happy-path] updates the stored claim with the real verdict and reasoning, and marks it investigated
