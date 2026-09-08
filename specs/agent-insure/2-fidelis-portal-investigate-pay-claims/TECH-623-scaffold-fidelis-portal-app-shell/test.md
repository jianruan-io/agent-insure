# Test Plan · Scaffold Fidelis Portal app shell

**Layer:** TS Unit

**Files:**
- `apps/fidelis/src/lib/claims/__tests__/stats.test.ts`
- `apps/fidelis/src/lib/claims/__tests__/transitions.test.ts`

**Run:** `cd apps/fidelis && npx vitest run`

---

## Tests

**claims/stats**

- **computeClaimStats**
  - [happy-path] counts every claim as filed, regardless of status
  - [happy-path] counts only claims with status "approved" as paid
  - [boundary] an empty claims list reports zero filed and zero paid

- **getRecentPayouts**
  - [happy-path] returns only claims with status "approved"
  - [happy-path] orders the returned claims most-recently-paid first
  - [boundary] no approved claims returns an empty list

**claims/transitions**

- **investigateClaim**
  - [happy-path] an un-investigated claim becomes investigated with a verdict and reasoning set
  - [unhappy-path] a claim that is already investigated is returned unchanged (no-op, per Core Logic's guarded self-transition)

- **payClaim**
  - [happy-path] an investigated, unpaid claim becomes "approved" and its amount is deducted from the pool balance
  - [unhappy-path] a claim that has not been investigated yet is returned unchanged and the pool balance is untouched
  - [unhappy-path] a claim that is already "approved" is returned unchanged and the pool balance is untouched (no double-deduction)
