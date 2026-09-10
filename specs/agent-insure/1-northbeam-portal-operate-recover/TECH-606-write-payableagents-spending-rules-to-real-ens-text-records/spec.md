# Write PayableAgent's spending rules to real ENS text records

## Overview

**What:**
When Northbeam's AP controller locks PayableAgent's spending rules, the budget cap and vendor list become a real, permanent, publicly-readable record — not a flag that only exists in the AP controller's own browser tab.

**Why:**
Today, clicking "Lock Rules On-Chain" changes nothing outside the tab it was clicked in. There is no actual spending-scope contract for a disputed payment to be judged against later, no independent record an insurer or auditor can check for themselves, and no real guarantee the rules weren't quietly changed after the fact.

**How:**
The AP controller's own crypto wallet signs the write, live, in front of them — publishing the budget cap and vendor list to a real record anyone can look up — and then signs a second action that permanently locks that record, so it can never be changed again by anyone, including the AP controller themselves.

**Zone 1 check:**
Implementation. This moves the spending-rules lock from a Design-stage mock (a local flag flipped in one browser, silently reversible, invisible to anyone else) to a real, independently-verifiable public record that any outside party — the insurer, an auditor, a judge of the disputed claim — can check for themselves without taking Northbeam's word for it.

---

## Core Logic

```mermaid
flowchart TD
    START(["AP controller clicks<br/>Lock Rules On-Chain"]) --> CONNECT["Browser wallet connects<br/>(MetaMask)"]
    CONNECT --> WRITE["Wallet signs write #1:<br/>budget cap + vendor list<br/>→ payableagent.agentinsure.eth records"]
    WRITE --> CONFIRM1["Transaction confirms on Sepolia"]
    CONFIRM1 --> LOCK["Wallet signs write #2:<br/>revoke the AP controller's own<br/>edit permission (Enhanced Access Control)"]
    LOCK --> CONFIRM2["Transaction confirms on Sepolia"]
    CONFIRM2 --> SHOW["Rules screen shows both tx hashes,<br/>Sepolia Etherscan links, and Locked —<br/>read back from the real on-chain state"]
    CONNECT -- "no wallet found /<br/>connection rejected" --> ERR1["Real error shown — rules stay unlocked"]
    WRITE -- "signature rejected /<br/>transaction reverts" --> ERR2["Real error shown — nothing written, rules stay unlocked"]
    LOCK -- "signature rejected /<br/>transaction reverts" --> ERR3["Real error shown — written but not locked"]
```

### Business rules

- The Rules screen only shows "Locked" after reading the lock state back from the actual on-chain record — never from the button click alone.
- Locking is two separate signed transactions, write then lock. A failure between them leaves a real, distinct, visible "written but not locked" state on screen — it is never silently treated as either fully locked or fully unlocked.
- The budget cap and vendor list values written on-chain are exactly the existing fixed values already shown in the UI — this issue does not add editing for either field.
- Once the lock transaction confirms, the AP controller's own wallet can no longer write to `payableagent.agentinsure.eth`'s records — enforced by the real on-chain permission system (Enhanced Access Control), not by the frontend merely hiding an edit button.

---

## File Tree

```
scripts/
  register-agentinsure-eth.mjs   # new — one-time script: registers agentinsure.eth on the hackathon's ETHRegistrar with PermissionedResolverImpl as its resolver. Run once by hand before this spec's other items are verified — not part of the live demo flow.
apps/northbeam/
  package.json                   # modified — add viem
  .env.example                   # modified — document the registered name and the hackathon contract addresses read at runtime
  src/
    lib/
      ens.ts                     # new — wallet connect + write/lock/read against payableagent.agentinsure.eth
      store.ts                   # modified — lockRules becomes async, drives the real write-then-lock flow
    pages/
      Rules.tsx                  # modified — Lock Rules On-Chain triggers the real flow; shows tx hashes, Etherscan links, and each error state from Core Logic
  e2e/
    lock-rules.spec.ts           # new — real, headed Playwright proof using a documented test-mode signer
```

---

## Action Items

**[ ] Register `agentinsure.eth` once, on the hackathon's ENSv2 deployment**

Implement: Create `scripts/register-agentinsure-eth.mjs` — checks whether `agentinsure.eth` is already registered on the hackathon's `ETHRegistrar` (`0x7d1b7f586a62ac3f54b9a396849757814283270b`); if not, mints and approves `MockUSDC` (`0xcbfd80f74375c54e545af34788ff465f96f66f05`) as payment and registers it with `PermissionedResolverImpl` (`0xa9d3814ab151bf6e37a427432795371a8361614e`) set as its resolver, owned by `SEPOLIA_WALLET_ADDRESS`. Document these addresses plus the registered name in `.env.example`. Run once, by hand, before verifying the remaining items.

Verify:
```
node scripts/register-agentinsure-eth.mjs
```
→ exits 0; prints a real transaction hash on first run, prints "already registered, skipping" on every run after

**[x] Build the ENS write/lock/read client**

Implement: Create `apps/northbeam/src/lib/ens.ts`, overriding viem's default Sepolia Universal Resolver with the hackathon's `UpgradableUniversalResolverProxy` (already in `.env.local` as `ENS_UNIVERSAL_RESOLVER_ADDRESS`). Exposes:
- `writeSpendingRules(budgetCap, vendors)` — connects the browser wallet and, in one signed transaction (resolver multicall), writes the budget cap and vendor list to `payableagent.agentinsure.eth`'s text records
- `lockSpendingRules()` — a second signed transaction revoking the connected wallet's own write permission on those records via Enhanced Access Control
- `readSpendingRulesState()` — reads the current text record values and whether write permission has been revoked; requires no wallet or signature

Verify:
```
npm run build --prefix apps/northbeam
```
→ exits 0, no type errors

**[x] Wire Rules.tsx to the real write-then-lock flow**

Implement: Update `lockRules` in `apps/northbeam/src/lib/store.ts` to call `ens.ts`'s write-then-lock flow instead of flipping local state directly, storing both returned transaction hashes and setting `rules.locked` true only once `readSpendingRulesState()` confirms the permission was actually revoked on-chain. Update `apps/northbeam/src/pages/Rules.tsx` to show both transaction hashes as Sepolia Etherscan links, the distinct "written but not locked" state, and a real error banner for each rejected-signature or reverted-transaction case from the Core Logic diagram.

Verify:
```
npm run build --prefix apps/northbeam
```
→ exits 0, no type errors

**[ ] Prove it end-to-end against the real chain**

Implement: Add `apps/northbeam/e2e/lock-rules.spec.ts` — a real, headed Playwright test that clicks Lock Rules On-Chain and drives the write-then-lock flow through a documented test-mode signer (a Sepolia private key used only in test mode, following the same documented convention as `apps/northbeam/e2e/selfie-check.spec.ts`, since Playwright cannot click a real MetaMask popup), asserting the UI ends on real transaction hashes and an on-chain-confirmed Locked state.

Verify:
```
npx playwright test apps/northbeam/e2e/lock-rules.spec.ts --reporter=list
```
→ exits 0, all steps pass, trace and video captured under `test-results/`

---

## Known gap — flagged, not resolved here

Action Items 1 and 4 need a real, funded Sepolia wallet's private key — something this session doesn't have and shouldn't generate or ask to have pasted into chat. Both are written and verified as far as possible without one:

- `scripts/register-agentinsure-eth.mjs` (relocated from the spec's original `scripts/` path to `apps/northbeam/scripts/` — this repo has no root `package.json`/`node_modules` to run a top-level script from, so it lives alongside the `viem` dependency it needs) has been checked against the real, live hackathon contracts: `agentinsure.eth` is confirmed available on the real `ETHRegistrar` right now, and both the registrar and resolver ABIs used were verified by fetching the hackathon deployment's actual verified source from Sourcify (not guessed from generic docs) and cross-checked with live read-only calls against the deployed contracts.
- `apps/northbeam/e2e/lock-rules.spec.ts` is written, type-checks, and is listed correctly by Playwright, but is `test.skip`ped without `SEPOLIA_PRIVATE_KEY` set — it has not yet been run for real.

One wallet plays PayableAgent throughout — no separate "Agent Insure issues to Northbeam" step, since `journey.json`'s steps for this goal are all assigned to a single actor (Northbeam) and nothing in ENS's judging criteria needs a second party. That wallet's key signs the one-time setup script (below) and, separately, the same address connects live via MetaMask for the demo.

Env vars follow this repo's existing split, unchanged: the root `.env.local` is for server/script secrets only (`server/src/index.js` already documents this convention — "Secrets live in the repo-root .env.local, not inside server/"), and `apps/northbeam/.env.local` is for the frontend's own `VITE_`-prefixed, browser-safe values. The registration script and `lock-rules.spec.ts` both load the root file directly via `process.loadEnvFile()`, matching how `server/` loads it.

To close this gap: add a Sepolia-testnet-only private key (no real value at stake) to the repo root `.env.local` as `SEPOLIA_PRIVATE_KEY` — it drives both the one-time registration script and the e2e proof. Once registration succeeds, its printed `VITE_ENS_RESOLVER_ADDRESS` needs adding to `apps/northbeam/.env.local` (not the root file) before the e2e spec or the live app can do anything. **The Enhanced Access Control lock this issue implements is genuinely permanent** — once `lock-rules.spec.ts` passes for real once, that resolver's write permission is revoked forever; re-running it after that only re-confirms the already-locked state (handled explicitly in the test), it can never re-test the fresh write path against the same name again.

Also worth flagging: Action Item 2's original text assumed reading/writing would go through viem's Universal Resolver override. Building it revealed a simpler path — `payableagent.agentinsure.eth` is a non-tokenized wildcard subname, so `ens.ts` talks directly to the resolver proxy `scripts/register-agentinsure-eth.mjs` deploys (via its own `resolve()`/`setText()`/`revokeRootRoles()`), never through viem's ENS convenience functions at all. That sidesteps the hackathon-vs-production Universal Resolver mismatch entirely rather than needing the override.
