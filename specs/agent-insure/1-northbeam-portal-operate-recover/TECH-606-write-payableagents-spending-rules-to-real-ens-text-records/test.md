# Test Plan · Write PayableAgent's spending rules to real ENS text records

**Layer:** TS Unit (Frontend)

**File:** `apps/northbeam/src/lib/__tests__/ens.test.ts`

**Run:** `npx vitest run` (from `apps/northbeam/` — adds `vitest` and a `test` script there; no unit runner exists in this app yet)

---

## Tests

**ens.ts**

- **deriveLockState** — turns a raw on-chain readback into the Rules screen's state
  - [happy-path] no records written yet, write role untouched → `not-written`
  - [happy-path] records are written and the write role has been revoked → `locked`
  - [boundary] records are written but the write role has NOT been revoked → `written-not-locked`

- **buildSpendingRulesCalls** — encodes the one multicall transaction for write #1
  - [happy-path] a budget cap and a non-empty vendor list produce exactly two encoded calls, one per text record key
  - [boundary] an empty vendor list still produces a valid encoded call, not an error

- **classifyLockError** — maps a raw wallet/chain error to one of Core Logic's three named error states
  - [happy-path] no injected wallet found → `wallet-not-found`
  - [happy-path] user rejects the connection prompt → `connection-rejected`
  - [happy-path] user rejects a signature request → `signature-rejected`
  - [happy-path] a submitted transaction reverts on-chain → `tx-reverted`
  - [unhappy-path] an unrecognized error shape → falls back to a generic error state, never throws

---

## Not covered here

The actual wallet connection, on-chain write, lock, and read calls against `payableagent.agentinsure.eth` are proved for real — no mocks — by this spec's own Playwright Action Item (`apps/northbeam/e2e/lock-rules.spec.ts`), matching this repo's `/e2e-verify` convention that on-chain outcomes are proven against the real chain, not simulated in a unit suite.
