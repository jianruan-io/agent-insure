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
  account: string;
  amount: number;
  time: string;
  flagged: boolean;
  /** True once a claim has been filed against this row — the flagged banner then adds
   *  "· claim filed", and it stops counting as the one open flag a new claim can target. */
  claimed: boolean;
  /** Whether this row's "reason" toggle is currently expanded. */
  expanded: boolean;
  reasoning: string;
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
}

const STORAGE_KEY = 'agent-insure-northbeam-v1';

// Both Northbeam and Fidelis run on localhost during the hackathon — see SelfieModal.tsx.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

const NORMAL_REASONING = 'Matches the locked vendor list — same account as every past payment. Approved.';
const ATTACK_REASONING =
  'New account for this vendor — never paid before. Outside the locked vendor list. Looks like manipulation, not a normal decision.';

function seedState(): StoreState {
  return {
    rules: {
      budgetCap: 5000,
      locked: false,
      vendors: [{ name: 'Acme Corp', account: '0x492b…c11a' }],
      writeTxHash: null,
      lockTxHash: null,
      lockStatus: 'idle',
      lockError: null,
    },
    activity: [
      {
        id: 'a1',
        vendor: 'Acme Corp',
        account: '0x492b…c11a',
        amount: 500,
        time: 'Mon 9:03 AM',
        flagged: false,
        claimed: false,
        expanded: false,
        reasoning: NORMAL_REASONING,
      },
      {
        id: 'a2',
        vendor: 'Acme Corp',
        account: '0x492b…c11a',
        amount: 500,
        time: 'Wed 2:15 PM',
        flagged: false,
        claimed: false,
        expanded: false,
        reasoning: NORMAL_REASONING,
      },
    ],
    claims: [
      {
        id: 'c0',
        vendor: 'Global Freight Co',
        amount: 1200,
        time: 'last month',
        seed: true,
        status: 'approved',
        reasoning: 'New account, never paid before. Outside the locked vendor list.',
      },
    ],
    nextActId: 3,
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
    // Merge onto a fresh seed's `rules` so a browser that persisted state before this
    // issue's new fields existed doesn't end up with `undefined` lock-flow fields.
    return { ...seedState(), ...parsed, rules: { ...seedState().rules, ...parsed.rules } };
  } catch {
    return seedState();
  }
}

type Action =
  | { type: 'lock-rules-status'; status: RulesLockStatus }
  | { type: 'lock-rules-write-confirmed'; txHash: string }
  | { type: 'lock-rules-locked'; txHash: string | null }
  | { type: 'lock-rules-error'; message: string }
  | { type: 'simulate-normal-invoice' }
  | { type: 'simulate-poisoned-invoice' }
  | { type: 'toggle-reason'; id: string }
  | { type: 'file-claim'; activityId: string; claimId: string }
  | { type: 'complete-selfie'; claimId: string }
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

    case 'simulate-normal-invoice': {
      const vendor = state.rules.vendors[0];
      const entry: ActivityEntry = {
        id: `a${state.nextActId}`,
        vendor: vendor.name,
        account: vendor.account,
        amount: 500,
        time: 'Just now',
        flagged: false,
        claimed: false,
        expanded: false,
        reasoning: NORMAL_REASONING,
      };
      return { ...state, activity: [...state.activity, entry], nextActId: state.nextActId + 1 };
    }

    case 'simulate-poisoned-invoice': {
      const entry: ActivityEntry = {
        id: `a${state.nextActId}`,
        vendor: state.rules.vendors[0].name,
        // Always a brand-new account, never the locked vendor's own address — this is
        // what makes the row "poisoned": same vendor name, different real destination.
        account: '0x8f31…d92e',
        amount: 500,
        time: 'Just now',
        flagged: true,
        claimed: false,
        expanded: false,
        reasoning: ATTACK_REASONING,
      };
      return { ...state, activity: [...state.activity, entry], nextActId: state.nextActId + 1 };
    }

    case 'toggle-reason':
      return {
        ...state,
        activity: state.activity.map((a) => (a.id === action.id ? { ...a, expanded: !a.expanded } : a)),
      };

    case 'file-claim': {
      const source = state.activity.find((a) => a.id === action.activityId);
      if (!source) return state;
      const claim: ClaimEntry = {
        id: action.claimId,
        vendor: source.vendor,
        amount: source.amount,
        time: source.time,
        seed: false,
        status: 'awaiting-identity',
        reasoning: source.reasoning,
      };
      return {
        ...state,
        activity: state.activity.map((a) => (a.id === action.activityId ? { ...a, claimed: true } : a)),
        claims: [...state.claims, claim],
      };
    }

    case 'complete-selfie':
      return {
        ...state,
        claims: state.claims.map((c) => (c.id === action.claimId ? { ...c, status: 'submitted' } : c)),
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
  simulateNormalInvoice: () => void;
  simulatePoisonedInvoice: () => void;
  toggleReason: (id: string) => void;
  fileClaim: (activityId: string) => Promise<void>;
  completeSelfie: (claimId: string) => void;
  /** Re-seeds the whole store — the real equivalent of the prototype's `reset-demo`
   *  action, now that there's actual cross-screen state worth resetting. */
  resetDemo: () => void;
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
    simulateNormalInvoice: () => dispatch({ type: 'simulate-normal-invoice' }),
    simulatePoisonedInvoice: () => dispatch({ type: 'simulate-poisoned-invoice' }),
    toggleReason: (id) => dispatch({ type: 'toggle-reason', id }),
    fileClaim: async (activityId) => {
      const source = state.activity.find((a) => a.id === activityId);
      if (!source) return;
      const response = await fetch(`${API_URL}/api/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: source.vendor, amount: source.amount, activityId }),
      });
      if (!response.ok) throw new Error('Could not file the claim.');
      const claim = await response.json();
      dispatch({ type: 'file-claim', activityId, claimId: claim.id });
    },
    completeSelfie: (claimId) => dispatch({ type: 'complete-selfie', claimId }),
    resetDemo: () => dispatch({ type: 'reset' }),
  };

  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
