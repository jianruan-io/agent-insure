import { useStore, type StoreState } from '../lib/store.js';

/**
 * Mirrors the published prototype's `renderDemoBar()` hint logic exactly: walk the same
 * state checks, in the same order, to decide what to nudge the person toward next. Now
 * that Rules, Activity, and Claims are real screens with real state, this replaces the
 * hardcoded "lock the spending rules" string from the shell-only piece of work.
 */
function getHint(state: StoreState): string {
  const openFlag = state.activity.find((a) => a.flagged && !a.claimed);
  const nonSeedClaims = state.claims.filter((c) => !c.seed);
  const awaiting = nonSeedClaims.find((c) => c.status === 'awaiting-identity');
  const submitted = nonSeedClaims.find((c) => c.status === 'submitted');

  if (!state.rules.locked) return 'Next: lock the spending rules — Rules.';
  if (!openFlag && nonSeedClaims.length === 0) return 'Next: simulate a poisoned invoice — Activity.';
  if (openFlag) return 'Next: file a claim for the flagged payment — Claims.';
  if (awaiting) return 'Next: complete the live face scan on that claim.';
  if (submitted) return 'Filed. Resolution now happens on Agent Insure’s side.';
  return 'Click through each screen — everything here is live.';
}

/**
 * The thin demo-guide strip pinned above the whole app shell: a "DEMO GUIDE" label, a
 * hint that reacts to the shared store's real state, and a reset action that re-seeds the
 * store (the real equivalent of the prototype's `reset-demo`, now that there's actual
 * cross-screen state to reset instead of just reloading the page).
 */
export function DemoBar() {
  const { state, resetDemo } = useStore();
  const hint = getHint(state);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-dashed border-border bg-muted/50 px-4 py-1.5 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Demo guide
      </span>
      <span className="text-muted-foreground">{hint}</span>
      <button
        type="button"
        onClick={resetDemo}
        className="ml-auto text-muted-foreground hover:text-foreground"
      >
        ↺ reset
      </button>
    </div>
  );
}
