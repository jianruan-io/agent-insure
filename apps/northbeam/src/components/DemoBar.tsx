/**
 * The published prototype's hint text is computed from cross-screen state (rules
 * locked? a payment flagged? a claim filed?) via `renderDemoBar()`. Rules, Activity, and
 * Claims aren't real screens yet in this piece of work, so that logic has nothing to read
 * — the hint is hardcoded to the prototype's seed state instead: rules aren't locked yet,
 * so the next step is always "lock the spending rules." Once Rules ships as a real screen,
 * this should be replaced with the full state-driven hint from the prototype.
 */
const HINT_TEXT = 'Next: lock the spending rules — Rules.';

/**
 * The thin demo-guide strip pinned above the whole app shell: a "DEMO GUIDE" label, the
 * current hint, and a reset action. The published prototype's reset re-seeds in-memory
 * state across every screen; since only Overview is real content so far, there's no
 * cross-screen state to re-seed, so this reset just reloads the page as the closest
 * honest stand-in until Rules/Activity/Claims exist and have real state to reset.
 */
export function DemoBar() {
  function handleReset() {
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-dashed border-border bg-muted/50 px-4 py-1.5 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Demo guide
      </span>
      <span className="text-muted-foreground">{HINT_TEXT}</span>
      <button
        type="button"
        onClick={handleReset}
        className="ml-auto text-muted-foreground hover:text-foreground"
      >
        ↺ reset
      </button>
    </div>
  );
}
