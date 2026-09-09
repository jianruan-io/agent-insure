# Test Plan · Wire claim filing to a real backend record

**Layer:** BE Unit — JS / vitest, following the existing convention in `server/src/routes/__tests__/world.test.js` (this repo's server has no TypeScript; `ts-unit.md`'s structure applies directly, just untyped)

**File:** `server/src/routes/__tests__/claims.test.js`

**Run:** `cd server && npm test`

---

## Tests

**claims.js**

- **createClaim**
  - [happy-path] creates a claim record with a fresh id, the given vendor, amount, and activityId, and a `"draft"` status
  - [happy-path] gives each new claim a different id from the one before it

---

## Not covered by a unit test — covered by Playwright instead

- **Route wiring** (`registerClaimRoutes` mounting `POST /api/claims`, and its registration in `server/src/index.js`): follows the same pattern as `registerWorldRoutes`, which `world.test.js` also doesn't test directly — the spec's own `curl` Verify clause is the acceptance check for the wired route, same precedent as TECH-610.
- **Frontend (`store.ts`, `Claims.tsx`)**: this repo has no unit-test harness for `apps/northbeam` (Playwright E2E only, per `TECH-610`'s precedent). Covered instead by `apps/northbeam/e2e/claim-filing.spec.ts` — a real, headed run (no mocks either side) against the real backend, trace + video captured, per `spec.md`'s flagged `journey.json` gap.
