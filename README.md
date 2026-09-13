# Agent Insure: Insurance for AI Agents Against LLM Prompt-Injection Fraud, Built on Hedera, ENS and World

## Live Demo

| App | Role | URL |
|---|---|---|
| Northbeam Portal | Insured business | https://insured-business.up.railway.app |
| Agent Insure HQ | Insurer | https://agent-insure-hq.up.railway.app |
| Backend API | Shared server | https://server-production-67ed4.up.railway.app |

---

## What

Agent Insure is insurance for AI agents that hold and spend money on their own.

An agent's spending rules (its budget cap and its approved vendor list) are locked into a real ENS record onchain, not just shown on a screen. Every payment the agent makes is logged permanently on Hedera. To file a claim, a real human has to scan their face with World, so a script cannot fake the whole loss and claim by itself. If a payment looks like fraud, the claim pays out automatically from a shared pool.

It works like the insurance a company already buys to cover an employee who steals or makes a mistake, just extended to cover an AI agent instead.

## Why

AI agents are starting to hold real wallets and spend real money. That opens them up to a trick called prompt injection: hidden text inside something the agent reads, like an invoice, that tells the agent to do something it should not. The agent cannot always tell a hidden instruction apart from a real one. Once it is tricked into paying, the payment is final. There is no chargeback like a credit card has.

A company handing an agent real spending power needs a safety net for that kind of loss. Not a promise that fraud will never happen, since no defense catches every trick, but a real payout when it does.

## How

Two separate companies play two separate roles, so nobody is grading their own homework.

- **Northbeam Distributors** is the insured business. Its AP controller, Guardian, runs PayableAgent, which pays vendors under a locked spending rule.
- **Agent Insure** is the insurer. It holds the shared pool and runs two separate agents: one that investigates a claim, and a different one that actually pays it out, so a compromised investigator can never pay itself.

A fake invoice tricks PayableAgent into paying the wrong account. The payment is logged on Hedera right away. Guardian notices the real vendor was never paid, files a claim, and proves it is really them with a live World face scan. InvestigatorAgent then checks the payment against Hedera's own history and the locked ENS rule, and decides if it looks like fraud. If it does, PayoutAgent independently double-checks that decision and pays Northbeam back from the shared pool.

---

## Run It Locally

```bash
git clone https://github.com/jianruan-io/agent-insure.git
cd agent-insure
cp .env.example .env.local   # fill in real keys (Hedera, ENS/Sepolia, World)

# backend, http://localhost:8787
cd server && npm install && npm run dev

# Northbeam Portal (insured), http://localhost:6323
cd apps/business && npm install && npm run dev

# Agent Insure HQ (insurer), http://localhost:6324
cd apps/hq && npm install && npm run dev
```

End to end tests (needs the three apps above already running):

```bash
npm install
npm run test:e2e
```

---

## Architecture

```mermaid
flowchart TD
    subgraph NORTHBEAM["Northbeam Distributors (insured)"]
        PA["PayableAgent pays vendors<br/>under a locked ENS rule"]
        GUARD["Guardian proves it's really them<br/>with a live World face scan"]
    end
    subgraph ATTACKER["External attacker"]
        MAL["Hides a fake instruction<br/>inside a routine invoice"]
    end
    subgraph INSURER["Agent Insure (insurer)"]
        INV["InvestigatorAgent checks the payment<br/>against Hedera history and the ENS rule"]
        PAY["PayoutAgent pays from<br/>the shared pool on Hedera"]
    end

    PA -->|"tricked into a wrong payment"| MAL
    MAL --> GUARD
    GUARD -->|"claim filed"| INV
    INV -->|"looks like fraud"| PAY
    INV -->|"matches normal pattern"| DENY["Claim denied"]

    style PA fill:#eaf1ff,stroke:#4c82fb,stroke-width:2px
    style GUARD fill:#fff6e0,stroke:#e0a825,stroke-width:2px
    style INV fill:#f1edff,stroke:#7c5cff,stroke-width:2px
    style PAY fill:#f1edff,stroke:#7c5cff,stroke-width:2px
```

---

## Screenshots

**1. Northbeam locks PayableAgent's spending rule.** Budget cap and approved vendor list, locked on ENS.

![Setting the AI agent's spending rule](images/set-ai-agent-spending-rule.png)

**2. That rule is a real ENS record onchain**, not just a screen. Anyone can look it up.

![The spending rule as a real ENS record](images/ens-agent-spending-rule.png)

**3. A vendor invoice hides a fake instruction inside it**, invisible to a human, telling PayableAgent to pay a different account.

![A prompt-injected invoice](images/prompt-injected-invoice.png)

**4. The tricked payment is real**, a tiny insurance payment settled through x402 on Hedera, checkable on Hedera's own explorer.

![The x402 insurance payment on Hedera](images/prompt-injected-invoice-x402-insurance.png)

**5. Filing a claim requires a real person.** Guardian scans a code with the World app.

![World QR code required to file a claim](images/human-kyc-required-world-qr-code.png)

**6. World checks that a real human, not a bot, is filing the claim.**

![World's real face-scan check](images/world-popup-proof-human.png)

**7. Agent Insure HQ finds the fraud and pays the claim.** InvestigatorAgent's verdict, then PayoutAgent's payout, from the shared reserve pool.

![Agent Insure HQ investigates and pays the claim](images/insurer-hq-investigate.png)
