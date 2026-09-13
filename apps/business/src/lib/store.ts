import { createContext, createElement, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { LockFlowError, lockSpendingRules, readSpendingRulesState, writeSpendingRules, type LockErrorKind } from './ens.js';

/**
 * Northbeam's shared demo state — one React context + `useReducer` store, replacing the
 * static `seed-data.ts` import so that locking rules on `/rules` is immediately visible
 * on `/` and `/activity`, filing a claim on `/claims` reflects back on `/activity`, etc.
 * Shape, seed values, and transitions mirror the published prototype's `seedState()` and
 * its click-handler `case` blocks exactly (see the prototype's `<script>` tag).
 */

export interface Vendor {
  name: string;
  /** Truncated wallet address, e.g. "0x492b…c11a" — always rendered in the mono track. */
  account: string;
}

export interface ActivityEntry {
  id: string;
  vendor: string;
  /** The real Hedera account the payment actually reached — not the old ENS-scope address. */
  account: string;
  time: string;
  flagged: boolean;
  /** True once a claim has been filed against this row — the flagged banner then adds
   *  "· claim filed", and it stops counting as the one open flag a new claim can target. */
  claimed: boolean;
  /** The claim filed against this row, if any — lets the Activity feed look up that
   *  claim's live status (and its real payout tx, once Agent Insure pays it) directly
   *  from `state.claims`, rather than duplicating payout data onto this row. */
  claimId?: string;
  reasoning: string;
  /** The actual invoice payment — real mUSDC, PayableAgent → the vendor (or the attacker's
   *  account, on a poisoned row). A distinct, separate transaction from the insurance
   *  payment below, both in what it's for and in its own real transaction hash. */
  vendorPaymentUsd: number;
  vendorPaymentTxHash: string;
  /** The x402 insurance/coverage toll — also real mUSDC, but a small fixed amount charged
   *  to Agent Insure's reserve pool, unrelated in size to the invoice. A separate real
   *  transaction, settled before the vendor payment is ever attempted. */
  insurancePaymentUsd: number;
  insurancePaymentTxHash: string;
  /** The real x402 "402 Payment Required" protocol payload PayableAgent received, and the
   *  facilitator's real settlement outcome — straight from the server, never invented. The
   *  settlement's own onchain proof is `insurancePaymentTxHash` above, not this payload. */
  x402?: {
    challenge: {
      x402Version: number;
      accepts: Array<{ scheme: string; network: string; asset: string; payTo: string; amount: string; extra?: { feePayer?: string } }>;
    };
    settlement: { success: boolean; network: string };
  };
  /** The real invoice document PayableAgent read, hidden instruction included on a
   *  poisoned row — straight from the server's real response, present on every row. */
  invoiceHtml?: string;
}

export type ClaimStatus = 'approved' | 'submitted' | 'awaiting-identity';

export interface ClaimEntry {
  id: string;
  vendor: string;
  amount: number;
  time: string;
  /** True only for the one historical claim baked into the seed state (already resolved
   *  before this demo's timeline starts) — the demo-guide hint logic ignores seed claims
   *  when deciding what to nudge the user toward next. */
  seed: boolean;
  status: ClaimStatus;
  reasoning: string;
  /** The real Hedera transaction PayoutAgent executed — only set once Agent Insure has
   *  actually paid this claim back. */
  payoutTxHash: string | null;
}

export type RulesLockStatus = 'idle' | 'connecting' | 'writing' | 'written' | 'locking' | 'locked' | 'error';

export interface RulesState {
  budgetCap: number;
  locked: boolean;
  vendors: Vendor[];
  /** Real Sepolia transaction hashes, once each write actually confirms — never invented. */
  writeTxHash: string | null;
  lockTxHash: string | null;
  lockStatus: RulesLockStatus;
  lockError: string | null;
}

export interface StoreState {
  rules: RulesState;
  activity: ActivityEntry[];
  claims: ClaimEntry[];
  nextActId: number;
  /** True while a real payment simulation (either button) is in flight. */
  activitySimulating: boolean;
  activitySimulateError: string | null;
}

const STORAGE_KEY = 'agent-insure-business-v1';

// Both Northbeam and Agent Insure HQ run on localhost during the hackathon — see SelfieModal.tsx.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

function seedState(): StoreState {
  return {
    rules: {
      budgetCap: 5000,
      locked: false,
      // Real Hedera account — the one PayableAgent actually pays (server/src/routes/activity.js),
      // not the original prototype's Ethereum-style placeholder. Locking the old value would
      // make every real payment look like a deviation, even a genuinely correct one.
      vendors: [{ name: 'Acme Corp', account: '0.0.10465723' }],
      writeTxHash: null,
      lockTxHash: null,
      lockStatus: 'idle',
      lockError: null,
    },
    // No fake starter rows — every row on this table comes from a real "Simulate…" click
    // and its real Hedera + x402 proof, never placeholder data with a made-up address or
    // fee that doesn't match the real ones the real flow produces.
    activity: [],
    claims: [
      {
        id: 'c0',
        vendor: 'Global Freight Co',
        amount: 1200,
        time: 'last month',
        seed: true,
        status: 'approved',
        reasoning: 'New account, never paid before. Outside the locked vendor list.',
        payoutTxHash: null,
      },
    ],
    nextActId: 1,
    activitySimulating: false,
    activitySimulateError: null,
  };
}

/** Reads persisted state back on mount, matching the prototype's own `loadState()` —
 *  a best-effort read wrapped in try/catch, falling back to a fresh seed whenever
 *  there's nothing there yet or what's there doesn't look like this store's shape. */
function loadState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<StoreState> | null;
    if (!parsed || !parsed.rules || !parsed.activity || !parsed.claims) return seedState();
    // A row from before a schema change (e.g. the old `amount`/`feeAmount` fields, before
    // they became `vendorPaymentUsd`/`insurancePaymentUsd`) would otherwise crash the whole
    // page the moment it tries to render — drop the whole activity list rather than ship a
    // white screen for one stale row. Persisted state is a demo convenience, never a source
    // of truth worth preserving across a real field rename.
    const activity = parsed.activity.every((entry) => typeof entry.vendorPaymentUsd === 'number') ? parsed.activity : [];
    // Merge onto a fresh seed's `rules` so a browser that persisted state before this
    // issue's new fields existed doesn't end up with `undefined` lock-flow fields.
    return { ...seedState(), ...parsed, activity, rules: { ...seedState().rules, ...parsed.rules } };
  } catch {
    return seedState();
  }
}

type Action =
  | { type: 'lock-rules-status'; status: RulesLockStatus }
  | { type: 'lock-rules-write-confirmed'; txHash: string }
  | { type: 'lock-rules-locked'; txHash: string | null }
  | { type: 'lock-rules-error'; message: string }
  | { type: 'simulate-start' }
  | { type: 'simulate-success'; entry: ActivityEntry }
  | { type: 'simulate-error'; message: string }
  | { type: 'file-claim'; activityId: string; claimId: string }
  | { type: 'complete-selfie'; claimId: string }
  | { type: 'claim-payout-confirmed'; claimId: string; payoutTxHash: string }
  | { type: 'reset' };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'lock-rules-status':
      return { ...state, rules: { ...state.rules, lockStatus: action.status, lockError: null } };

    case 'lock-rules-write-confirmed':
      return {
        ...state,
        rules: { ...state.rules, lockStatus: 'locking', writeTxHash: action.txHash },
      };

    case 'lock-rules-locked':
      return {
        ...state,
        rules: {
          ...state.rules,
          locked: true,
          lockStatus: 'locked',
          lockTxHash: action.txHash ?? state.rules.lockTxHash,
        },
      };

    case 'lock-rules-error':
      return { ...state, rules: { ...state.rules, lockStatus: 'error', lockError: action.message } };

    case 'simulate-start':
      return { ...state, activitySimulating: true, activitySimulateError: null };

    case 'simulate-success':
      return {
        ...state,
        activity: [...state.activity, action.entry],
        nextActId: state.nextActId + 1,
        activitySimulating: false,
      };

    case 'simulate-error':
      return { ...state, activitySimulating: false, activitySimulateError: action.message };

    case 'file-claim': {
      const source = state.activity.find((a) => a.id === action.activityId);
      if (!source) return state;
      const claim: ClaimEntry = {
        id: action.claimId,
        vendor: source.vendor,
        amount: source.vendorPaymentUsd,
        time: source.time,
        seed: false,
        status: 'awaiting-identity',
        reasoning: source.reasoning,
        payoutTxHash: null,
      };
      return {
        ...state,
        activity: state.activity.map((a) =>
          a.id === action.activityId ? { ...a, claimed: true, claimId: action.claimId } : a
        ),
        claims: [...state.claims, claim],
      };
    }

    case 'complete-selfie':
      return {
        ...state,
        claims: state.claims.map((c) => (c.id === action.claimId ? { ...c, status: 'submitted' } : c)),
      };

    case 'claim-payout-confirmed':
      return {
        ...state,
        claims: state.claims.map((c) =>
          c.id === action.claimId ? { ...c, status: 'approved', payoutTxHash: action.payoutTxHash } : c
        ),
      };

    case 'reset':
      return seedState();

    default:
      return state;
  }
}

function describeLockError(kind: LockErrorKind): string {
  switch (kind) {
    case 'wallet-not-found':
      return 'No wallet found — install MetaMask (or another injected wallet) to lock spending rules on-chain.';
    case 'connection-rejected':
      return 'Wallet connection was rejected.';
    case 'signature-rejected':
      return 'Transaction signature was rejected.';
    case 'tx-reverted':
      return 'The transaction reverted on-chain.';
    default:
      return 'Something went wrong locking the spending rules.';
  }
}

interface StoreContextValue {
  state: StoreState;
  lockRules: () => Promise<void>;
  /** Best-effort read of the real on-chain state — never trusts the click alone. */
  syncRulesFromChain: () => Promise<void>;
  simulateNormalInvoice: () => Promise<void>;
  simulatePoisonedInvoice: () => Promise<void>;
  fileClaim: (activityId: string) => Promise<void>;
  completeSelfie: (claimId: string) => void;
  /** Re-seeds the whole store and clears the shared backend claims record — the real
   *  equivalent of the prototype's `reset-demo` action, now that there's actual
   *  cross-screen (and cross-app, via Agent Insure HQ) state worth resetting. */
  resetDemo: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Provides the shared store to the whole app. Written with `createElement` instead of
 * JSX so this file can stay a plain `.ts` module, matching the rest of `src/lib`.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);

  // Persisted on every change, best-effort — matches the prototype's own try/catch
  // around localStorage, which never lets a write failure break the demo.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // no-op — persistence is a nice-to-have, not a requirement to keep working
    }
  }, [state]);

  // Polls the real claims record while any claim is still submitted — the same "click and
  // watch it happen live" pattern as everything else real in this demo, no manual reload
  // needed to see a claim actually get paid back.
  const pendingClaimIds = state.claims
    .filter((c) => c.status === 'submitted')
    .map((c) => c.id)
    .join(',');
  useEffect(() => {
    if (!pendingClaimIds) return;
    const pending = pendingClaimIds.split(',');

    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/claims`);
        if (!response.ok) return;
        const real: Array<{ id: string; status: string; payoutTxHash: string | null }> = await response.json();
        for (const claimId of pending) {
          const match = real.find((r) => r.id === claimId);
          if (match?.status === 'approved' && match.payoutTxHash) {
            dispatch({ type: 'claim-payout-confirmed', claimId, payoutTxHash: match.payoutTxHash });
          }
        }
      } catch {
        // Best-effort — a transient network hiccup just tries again next tick.
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [pendingClaimIds]);

  /** Calls the real payment pipeline (PayableAgent's real AI call reading the real invoice
   *  → x402 coverage fee → Hedera vendor transfer → HCS log) and dispatches its real result —
   *  reasoning and flagged state come straight from what PayableAgent actually decided, never
   *  chosen client-side by which button was clicked. */
  const simulateInvoice = async (kind: 'normal' | 'poisoned') => {
    dispatch({ type: 'simulate-start' });
    try {
      const response = await fetch(`${API_URL}/api/activity/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not simulate the payment.');
      const entry: ActivityEntry = {
        id: `a${state.nextActId}`,
        vendor: body.vendor,
        account: body.account,
        time: body.time,
        flagged: body.flagged,
        claimed: false,
        reasoning: body.reasoning,
        vendorPaymentUsd: body.vendorPaymentUsd,
        vendorPaymentTxHash: body.vendorPaymentTxHash,
        insurancePaymentUsd: body.insurancePaymentUsd,
        insurancePaymentTxHash: body.insurancePaymentTxHash,
        x402: body.x402,
        invoiceHtml: body.invoiceHtml,
      };
      dispatch({ type: 'simulate-success', entry });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not simulate the payment.';
      dispatch({ type: 'simulate-error', message });
    }
  };

  const value: StoreContextValue = {
    state,
    lockRules: async () => {
      dispatch({ type: 'lock-rules-status', status: 'connecting' });
      try {
        const onChain = await readSpendingRulesState();
        if (onChain.state === 'locked') {
          dispatch({ type: 'lock-rules-locked', txHash: null });
          return;
        }

        if (onChain.state === 'not-written') {
          dispatch({ type: 'lock-rules-status', status: 'writing' });
          const vendors = state.rules.vendors.map((v) => ({ name: v.name, account: v.account }));
          const { txHash } = await writeSpendingRules(state.rules.budgetCap, vendors);
          dispatch({ type: 'lock-rules-write-confirmed', txHash });
        }

        dispatch({ type: 'lock-rules-status', status: 'locking' });
        const { txHash } = await lockSpendingRules();
        dispatch({ type: 'lock-rules-locked', txHash });
      } catch (err) {
        const message = err instanceof LockFlowError ? describeLockError(err.kind) : 'Could not lock spending rules.';
        dispatch({ type: 'lock-rules-error', message });
      }
    },
    syncRulesFromChain: async () => {
      try {
        const onChain = await readSpendingRulesState();
        if (onChain.state === 'locked') {
          dispatch({ type: 'lock-rules-locked', txHash: null });
        } else if (onChain.state === 'written-not-locked') {
          dispatch({ type: 'lock-rules-status', status: 'written' });
        }
      } catch {
        // Best-effort — the resolver may not be configured/reachable yet; the Lock
        // button's own click flow surfaces a real error if so.
      }
    },
    simulateNormalInvoice: () => simulateInvoice('normal'),
    simulatePoisonedInvoice: () => simulateInvoice('poisoned'),
    fileClaim: async (activityId) => {
      const source = state.activity.find((a) => a.id === activityId);
      if (!source) return;
      const response = await fetch(`${API_URL}/api/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The real disputed destination — what InvestigatorAgent later compares against the
        // vendor's ENS-locked account, not just the vendor's name.
        body: JSON.stringify({ vendor: source.vendor, amount: source.vendorPaymentUsd, activityId, account: source.account }),
      });
      if (!response.ok) throw new Error('Could not file the claim.');
      const claim = await response.json();
      dispatch({ type: 'file-claim', activityId, claimId: claim.id });
    },
    completeSelfie: (claimId) => dispatch({ type: 'complete-selfie', claimId }),
    resetDemo: async () => {
      try {
        await fetch(`${API_URL}/api/claims`, { method: 'DELETE' });
      } catch {
        // Best-effort — the local reset below still gives a clean demo state even if
        // the shared backend record couldn't be cleared (e.g. server not running yet).
      }
      dispatch({ type: 'reset' });
    },
  };

  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
