# ETHOnline 2026 Submission — Agent Insure

Draft content for every field on https://ethglobal.com/events/ethonline2026/project, pulled from README.md and the actual repo (package.json deps, git remote, commit history). Copy each block straight into the matching form field. Fields marked **[YOUR CALL]** are decisions only you/the team can make — I've filled in the option I'd pick and why, so you can accept or override in one read.

---

## 1. Project details

### Project name
Agent Insure

### What category does your project belong to?
Artificial Intelligence

(already set on the form)

### What emoji best represents your project?
☂️

Umbrella = insurance / protection (matches the pitch deck's brand mark). (Alt: 🛡️ if you want "shield" instead, or 🤖 to lead with "agent.")

### If you have a demonstration, link to it here!
[PENDING] — paste the deployed app URL (Northbeam portal / Agent Insure HQ) once hosted, or the demo video URL once uploaded to YouTube/Loom. Leave blank until then rather than submitting a placeholder link.

### Short description
*(≤100 characters — currently 92)*

Insurance for AI agents — Hedera, ENS and World catch prompt-injection fraud and pay it out.

### Description
*(min 280 characters)*

Agent Insure is insurance for autonomous AI agents that hold and spend money on their own. As companies give agents real wallets and real spending authority, they become exposed to indirect prompt injection — hidden instructions buried in ordinary content, like a vendor invoice, that manipulate the agent into authorizing a payment its owner never intended. This isn't a bug someone will eventually patch: an LLM processes the system prompt, the user's request, and any content it reads (a PDF, a webpage, an invoice) as one undifferentiated stream of text, with no built-in boundary between "instruction to obey" and "data to read" — which is why OWASP, Microsoft, and Palo Alto's own 2026 security research all still call this unresolved at a structural level. Because stablecoin transfers have no chargeback mechanism, that loss is instant and irreversible.

We combine three pieces of infrastructure to cover it. An agent's allowed spending scope — budget cap, approved vendors — is written into its ENS identity as an enforceable record, not a display name. Every transaction is logged immutably through Hedera Consensus Service. Filing a claim requires the company's real, identified human to pass a live World Selfie Check first, so the entire loss-and-claim cycle can't be scripted end-to-end by software with nobody accountable. Hedera's Mirror Node then surfaces the agent's full transaction history so our AI claims-adjuster (InvestigatorAgent) can compare the disputed payment against its normal pattern and its declared ENS scope — if it looks like manipulation rather than a legitimate decision, PayoutAgent pays the claim automatically from a shared risk pool.

It's the same insurance companies already buy to cover employee theft or fraud — extended to cover an AI agent instead of a human employee.

### How it's made
*(min 280 characters)*

Two simulated companies run on Hedera testnet: Northbeam Distributors (the insured, running PayableAgent) and Agent Insure (the insurer, running InvestigatorAgent + PayoutAgent), plus an unaffiliated MaliciousAgent and a real human, Guardian.

PayableAgent's spending scope (budget cap, approved vendor list) is written into ENS text records behind a Permissioned Resolver, so it's a locked, machine-checkable record rather than a cosmetic name. MaliciousAgent crafts a vendor invoice with hidden prompt-injection text; PayableAgent reads it with an OpenAI-powered reasoning step and gets manipulated into authorizing a payment outside its declared ENS scope. Every PayableAgent transaction — including the bad one — is logged immutably to Hedera Consensus Service, paid through an x402-gated flow via the Blocky402 facilitator.

When the real vendor reports non-payment, Guardian (Northbeam's real AP controller) has to pass a live World Selfie Check before a claim can even be filed — this is what stops the whole loss-and-claim loop from being scriptable by software alone, with nobody accountable. Agent Insure's InvestigatorAgent then pulls PayableAgent's full history from Hedera Mirror Node, diffs the disputed payment against both that history and the locked ENS scope, and signs a verdict — it never touches money. PayoutAgent independently re-verifies that signed verdict (signature, active policy, pool balance) and is the only agent authorized to execute the actual Hedera payout back to Northbeam.

Stack: React 19 + TypeScript + Vite + Tailwind CSS + Radix UI for two separate frontends (Northbeam's portal, Agent Insure's HQ); Node.js + Express backend; @hiero-ledger/sdk + Hedera Mirror Node + Hedera Consensus Service for the chain layer; ENSv2 Permissioned Resolver via viem for identity/policy; @worldcoin/idkit-core for Selfie Check; @x402/core + @x402/hedera for the payment-gated invoice flow; OpenAI for the agents' reasoning steps; Playwright + Vitest for real end-to-end proof of every flow, no mocks.

### GitHub Repositories
https://github.com/jianruan-io/agent-insure

---

## 2. Images

These are file uploads, not text — no content to draft. Shot list based on what the app actually shows:

- **Logo** (512x512) — the 🛡️ mark, likely just needs a quick square asset made in Figma/Canva or generated.
- **Cover image** (16:9, e.g. 640x360) — a hero shot of Agent Insure HQ or the Northbeam portal.
- **Screenshots** (min 3) — pull from the actual UI once branches 1–2 are wired to real data: (1) Northbeam's spending-rules setup / ENS scope, (2) the poisoned invoice + PayableAgent's bad payment, (3) Agent Insure HQ's InvestigatorAgent verdict + PayoutAgent's real Hedera payout (per the recent `feat: show the real payout in Agent Insure HQ` commit, this screen should already exist).

---

## 3. Tech stack

### Are you using any Ethereum developer tools for your project?
viem, ENS (ENSv2, Permissioned Resolver)

### Which blockchain networks will your project interact with?
Hedera (testnet), Ethereum Sepolia (for ENS name resolution)

### Which programming languages are you using in your project?
TypeScript, JavaScript

### Are you using any web frameworks for your project?
React, Vite, Express, Tailwind CSS

### Are you using any databases for your project?
None — select "None"/leave blank. All state is derived live from Hedera Mirror Node and ENS records; no persistence layer needed.

### Are you using any design tools for your project?
None — select "None"/leave blank. UI was built directly in code with Tailwind CSS + Radix UI primitives, no separate design tool.

### Other specific technologies, libraries, frameworks, or tools
@hiero-ledger/sdk (Hedera SDK), x402 / Blocky402 facilitator, World ID (@worldcoin/idkit, @worldcoin/idkit-core), OpenAI API, Playwright, Vitest

### Describe how AI tools were used in your project
OpenAI models power two of the four agents' reasoning: PayableAgent reads the (poisoned) invoice content and decides whether/how to pay it, and InvestigatorAgent compares a disputed payment against Hedera Mirror Node history and the locked ENS spending scope to sign a fraud/legitimate verdict. Claude Code was used throughout development to implement and test the agents, the Hedera/ENS/World integrations, and the two frontends.

---

## 4. Select prizes

### Select your track for ETHOnline 2026 — **[YOUR CALL, default below]**
Building from Scratch

Matches the repo: new project, first commit this hackathon window.

### Submission type — **[YOUR CALL, default below]**
Top 10 Finalist & Partner Prizes

The build already demonstrates real, non-trivial multi-agent + multi-sponsor integration (not a thin wrapper), so it's worth the shot at general judging on top of partner prizes — pick "Partner Prizes only" instead if you don't want to commit to the live Sept 14 judging slot.

### Which partner prizes are you applying for? (max 3)
Hedera, ENS, World

These three are the deliberate, decided core stack (README explicitly rules out Arc and The Graph — see "Chain/sponsor stack — decided"). Why each is genuinely earned, not just used:

**Hedera — "AI & Agentic Payments"**

InvestigatorAgent's verdict is a real AI judgment call (reasoning over Mirror Node history + ENS scope) that gates a real payment executed by a separate agent, PayoutAgent — meeting the literal "AI agent executing a payment" bar, not deterministic automation. The two-agent split (judge vs. payer) also directly hits the stated multi-agent bonus criteria. Hedera Consensus Service logs every PayableAgent transaction immutably, and Mirror Node is the live, free, no-key data source InvestigatorAgent reasons over — a genuine drift-detection step, not a single display lookup.

*GitHub:* https://github.com/jianruan-io/agent-insure
*How easy is it to use the API/Protocol? (1–10):* 9

*Any feedback for the team?* Hedera's core primitives — Mirror Node, Consensus Service, the SDK itself — were genuinely the easiest part of this whole build: free, no API key, real docs, worked first try. The one rough edge was the newer `@x402/hedera` "exact" payment scheme, whose real requirements aren't visible in its type declarations: it silently requires a Hedera fee-payer account in `paymentRequirements.extra.feePayer` (only discoverable by reading Blocky402's own `/supported` response), the live testnet facilitator accepts only `x402Version: 2` and rejects version 1 outright with no actionable error, and the SDK's own suggested default asset (`HEDERA_TESTNET_USDC`) has no public testnet faucet — so following the type signatures alone builds something that only fails at runtime, three separate ways. We only closed these gaps by charging the fee against the live facilitator and reading its actual responses instead of trusting the declared types. Worth documenting `extra.feePayer`, the `x402Version` requirement, and a real testnet-USDC faucet (or defaulting the sample to HBAR) directly in the `@x402/hedera` README.

**ENS — "Best Use of ENSv2" / "AI agents as namespaces with delegated permissions"**

PayableAgent's declared spending scope — budget cap, approved vendor list — is written into its ENS text records behind a Permissioned Resolver and is the actual contract a disputed payment is judged against, not a display name. Guardian (the real human accountable for PayableAgent) is also registered via ENS. Both InvestigatorAgent's verdict and PayoutAgent's payout check the locked ENS record before acting — functional identity and delegated permissions, not cosmetic.

*GitHub:* https://github.com/jianruan-io/agent-insure
*How easy is it to use the API/Protocol? (1–10):* 8

*Any feedback for the team?* The read/write API itself (viem, text records, resolver calls) was straightforward — the friction was terminology drift between docs and actual chain state. The "lock" mechanic we needed is called a "Permissioned Resolver" in some ENSv2 material and "Enhanced Access Control" in the resolver's own role system (`revokeRootRoles`, `hasAssignees(ROOT_RESOURCE, ROLE_SET_TEXT)`) — same feature, two names, nothing ties them together, so confirming we'd built "the real thing" took inspecting the deployed resolver's roles directly rather than trusting either doc page. Separately, viem's built-in ENS convenience helpers (`getEnsText()` and friends) resolve against the public Sepolia Universal Resolver, which doesn't match a hackathon's own dedicated `UpgradableUniversalResolverProxy` deployment — we sidestepped this by talking to the resolver contract directly instead of viem's ENS helpers, but a first-time integrator following the "normal" viem+ENS path would silently hit the wrong resolver. Aligning the "Permissioned Resolver"/"Enhanced Access Control" naming, and flagging the Universal Resolver override for non-mainnet deployments, would remove both gotchas.

**World — "Selfie Check"**

Filing a claim against the shared risk pool — the single highest-stakes action in the flow — is gated behind a live World Selfie Check for Guardian, Northbeam's real AP controller. Without it, the entire loss-and-claim cycle could be scripted end-to-end by software with nobody accountable (a company or insider could stage a fake "hack" and auto-file the claim). This is a real abuse-prevention signal that closes an actual attack vector, not a login screen added for coverage.

*GitHub:* https://github.com/jianruan-io/agent-insure
*How easy is it to use the API/Protocol? (1–10):* 6

*Any feedback for the team?* The widget itself is simple to embed, but we lost real time to one undocumented mismatch: World ID 4.0's managed-RP setup only registers actions under "staging"/"production", while "sandbox" — the legacy value most getting-started material still defaults to — matches no registered action. Passing "sandbox" doesn't produce a helpful error: the real IDKit widget just fails instantly with a generic, pre-network error before it ever renders a QR code, with nothing distinguishing "wrong environment string" from a real config or network problem. We only found the fix by checking the Developer Portal API's own `actions_v4` list directly. That one string is the entire gap between "doesn't work" and "works" — fixing the docs/SDK default (or giving a specific error when the environment doesn't match a registered action) would have saved us hours of hard-to-debug failure.

### Which other partners' technologies have you used on your project?
Coinbase's x402 payment protocol — via `@x402/core` and `@x402/hedera`, settled through the Blocky402 facilitator — genuinely gates PayableAgent's vendor-payment flow (a real HTTP 402 challenge/pay/settle cycle, not a display integration); check that box if it's offered separately from the Hedera track above. Beyond x402, nothing else: Arc and The Graph were evaluated and deliberately not pursued (see README "Chain/sponsor stack — decided" for the reasoning).

---

## 5. Video

No text field here, but a ready script/shot list for the 2–4 minute demo (must have audio, no music, 720p+, no speed-ups):

0:00–0:20 — The problem: an AI agent has a real wallet. A hidden instruction inside a normal vendor invoice can trick it into authorizing a payment nobody approved — and once it's on-chain, it's irreversible. That's the exact risk Arc, Hedera, and Circle's Agent Stack are all betting real money on right now.

0:20–0:50 — Setup: show Northbeam Distributors' portal — PayableAgent's spending scope (budget cap, approved vendors) locked into its ENS record. This is the enforceable contract everything else gets checked against.

0:50–1:30 — The attack: MaliciousAgent's poisoned invoice. Show PayableAgent reading it, reasoning about it, and authorizing a payment outside its declared ENS scope. Show the transaction landing immutably in Hedera Consensus Service.

1:30–2:10 — The claim: the real vendor says they were never paid. Guardian (Northbeam's real AP controller) has to pass a live World Selfie Check before the claim is even filed — show this step explicitly, it's the whole point of including World.

2:10–2:50 — The investigation and payout: switch to Agent Insure HQ. InvestigatorAgent pulls PayableAgent's real history from Hedera Mirror Node, shows the deviation from the locked ENS scope, signs a verdict. PayoutAgent independently verifies it and executes the real payout on Hedera back to Northbeam.

2:50–3:10 — Close: one line tying it back — "It's the same insurance companies already buy to cover employee theft or fraud, extended to cover an AI agent instead of a human employee."

---

## 6. Future

### Are you interested in continuing your project? — **[YOUR CALL, default below]**
Yes — interested in continuing through grants programs (e.g. Hedera ecosystem grants, Ethereum Support Program) and would want introductions/support putting together an application.

---

## 7. Final

### Team
Jian Ruan — Developer

Confirm this is the full team before submitting; use "Edit Team" to invite anyone missing.

### Confirmation checkboxes
All are factually true for this build as described in the README (started from scratch this event, real GitHub commit history, open-source repo, not submitted elsewhere) — check all six, then **Submit project**.

---

## Notes on gaps (not a checklist — just what still blocks Submit)

- **Demo link + demo video** — no deployed URL or recorded video exists yet; the app is still UI-first per the README's Milestones section (branches 1–2 UI ✔, real backend wiring in progress/partially done per recent commits like `feat: show the real payout in Agent Insure HQ`).
- **Logo / cover image / 3 screenshots** — no image assets exist yet; need to be captured from the running app or designed fresh.
- **Personal "how you got into Web3" story** — flagged in the README as open, needs actual personal input, not something to draft from the repo.
