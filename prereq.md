# Prerequisites — ETHGlobal ETHOnline 2026

Setup checklist for both submissions: [`insurance-demo.md`](./insurance-demo.md) (Hedera + World + ENS) and [`tokenization-demo.md`](../ethglobal-online/tokenization-demo.md) (Hedera + Privy + ENS). This file is shared with the tokenization submission — kept in sync manually, not a symlink.

## ⚠️ Only one item needs sponsor approval

Everything below is self-serve — sign up and go. **Except World's Selfie Check**, which is Beta and gated behind a feature flag that World's own team has to enable for your app before it works at all. Unknown lead time. Request access **today, before writing any code**, in parallel with everything else — it's the one thing on this list that can actually block the insurance demo if left late.

## Setup table

| Item | Project | Access | Get it at | What you get | Notes |
|---|---|---|---|---|---|
| **World Selfie Check feature flag** | Insurance | 🔴 **Needs sponsor approval** | Request via World's developer contact / documented support path from [developer.world.org](https://developer.world.org/) | Permission for your app to actually use Selfie Check (Beta) | Unknown turnaround — the one real blocking risk in this whole list, start immediately |
| Hedera testnet account | Both | 🟢 Immediate | [portal.hedera.com](https://portal.hedera.com) | Operator Account ID + private key, free testnet HBAR | Everything else on Hedera depends on this existing first — do this literally first |
| Hedera Mirror Node | Both | 🟢 Immediate, no signup | `https://testnet.mirrornode.hedera.com/api/v1` | Public read API | No key at all — just start calling it |
| Hedera testnet USDC | Both | 🟢 Immediate | Circle testnet faucet — check [Circle's Hedera guide](https://www.usdc.com/learn/how-to-get-usdc-on-hedera) on build day | Test USDC, token ID `0.0.429274` | Must **associate** the token to each account first (a required one-time Hedera call); verify token ID/faucet route still current |
| Hedera Consensus Service topic | Insurance | 🟢 Immediate | Same operator account, one setup transaction | An HCS Topic ID | No separate signup — just a one-time call before PayableAgent can log to it |
| Hedera Asset Tokenization Studio | Tokenization | 🟢 Immediate | Open-source: [SDK/contracts](https://github.com/hashgraph/asset-tokenization-studio) or hosted [Web UI](https://tokenization-studio.hedera.com/) | Deployable tokenization contracts + optional UI | After deploying, you must self-grant yourself roles (mint, corporate actions, compliance) — easy step to forget |
| WalletConnect Cloud Project ID | Tokenization | 🟢 Immediate | [walletconnect.com](https://walletconnect.com) | A Project ID | Only needed if self-hosting the ATS Web UI |
| AI/LLM API key | Both | 🟢 Immediate | [console.anthropic.com](https://console.anthropic.com) (or your provider) | API key for the actual agent reasoning calls | Use a dedicated project key, not a personal/work one — cleaner for judges reviewing the repo |
| Sepolia RPC endpoint | Both | 🟢 Immediate | Alchemy or Infura, free tier | An RPC API key | Needed because ENSv2 beta lives on Sepolia, not Hedera — easy to forget it's a second chain's credentials |
| Sepolia testnet ETH | Both | 🟢 Immediate | Alchemy Sepolia faucet, or Google Cloud Web3 faucet | Gas for registering ENS names + setting records | — |
| ENSv2 beta contract addresses | Both | 🟢 Immediate, no signup | ENS's own ENSv2 docs/GitHub — pull fresh on build day | Current deployed contract addresses | Beta software, addresses can move — don't hardcode from an old writeup |
| Privy | Tokenization | 🟢 Immediate | [dashboard.privy.io](https://dashboard.privy.io) | App ID (public) + App Secret (server-side only) | Decide your quorum policy (e.g. 2-of-3) early — it's literally the judged bar |
| World Developer Portal app | Insurance | 🟢 Immediate | [developer.world.org](https://developer.world.org/) | App ID + an "Action" for the Selfie Check flow | Creating the app itself is self-serve; only the Selfie Check *capability* on it needs the approval above |
| World ID Sandbox App | Insurance | 🟢 Immediate | Same Developer Portal | Test app on your phone | Needed to actually record the live Selfie Check in the demo video |

## Setup order (what unblocks the most work, do in this sequence)

1. **Hedera testnet account** — everything else on Hedera depends on this existing first.
2. **World Selfie Check feature-flag request** (insurance only) — unknown lead time, so kick it off immediately, in parallel with everything else, even before you've written any code.
3. **Sepolia RPC key + Sepolia ETH** — unblocks all ENS work for either project.
4. Everything else (Privy signup, Anthropic key, ATS role grants, HCS topic creation) has no real lead time — same-day, whenever you get to that part of the build.

## Verify on build day (not guaranteed stable, don't trust this doc blindly for these)

- Hedera testnet USDC token ID (`0.0.429274`) and the actual faucet route to receive it.
- ENSv2 beta contract addresses — beta software, may have moved since this was written.
- World Selfie Check feature-flag approval turnaround — ask as early as possible; this is the one prerequisite here with a real chance of taking longer than a day.
