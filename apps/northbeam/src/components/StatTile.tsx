import * as React from 'react';
import { cn } from '../lib/utils';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  caption?: string;
  /** Overrides the value's text color — used for the Policy status tile, which reads
   *  warning-orange while rules are pending and would read success-green once locked. */
  valueClassName?: string;
}

/**
 * The label/value/caption stat card used across the four Overview tiles (Coverage limit,
 * Policy status, Claims filed, Claims paid). Matches DESIGN.northbeam.md's
 * `{components.stat-tile}` token.
 */
export function StatTile({ label, value, caption, valueClassName }: StatTileProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn('text-2xl font-bold tabular-nums', valueClassName)}>{value}</div>
      {caption ? <div className="mt-1 text-xs text-muted-foreground">{caption}</div> : null}
    </div>
  );
}
