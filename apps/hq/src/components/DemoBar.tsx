/**
 * Thin demo strip mirroring Northbeam's own DemoBar — a reset action for the same
 * shared backend claims record, since Agent Insure HQ reads that same record and can
 * otherwise only be reset by manually clearing Northbeam's state.
 */
export function DemoBar({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex items-center border-b border-dashed border-border bg-muted/50 px-4 py-1.5 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Demo guide
      </span>
      <button type="button" onClick={onReset} className="ml-auto text-muted-foreground hover:text-foreground">
        ↺ reset
      </button>
    </div>
  );
}
