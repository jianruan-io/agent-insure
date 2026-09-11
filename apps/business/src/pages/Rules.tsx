import { useEffect } from 'react';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card, CardContent } from '../components/ui/card.js';
import { StatTile } from '../components/StatTile.js';
import { useStore } from '../lib/store.js';

function etherscanTxUrl(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

const LOCK_BUTTON_LABEL: Record<string, string> = {
  idle: 'Lock Agent Spending Rules Onchain',
  written: 'Finish Locking Onchain',
  connecting: 'Connecting wallet…',
  writing: 'Writing to ENS…',
  locking: 'Locking permissions…',
  error: 'Retry Lock Agent Spending Rules Onchain',
};

/** Hand-drawn stroke SVG matching the approved Northbeam Portal prototype's check icon —
 *  same convention as AppSidebar.tsx/Overview.tsx (never an icon-library glyph). */
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4,10.5 8,14.5 16,5.5" />
    </svg>
  );
}

function money(amount: number) {
  return `$${amount.toLocaleString()}`;
}

/**
 * Northbeam's Rules screen — PayableAgent's enforceable spending scope. Reproduces the
 * published prototype's `screenRules()` at 1:1 content parity: the budget cap stat, the
 * fixed approved-vendor list (with the disabled "add vendor" row), and the
 * "Lock Agent Spending Rules Onchain" action. Locking flips `rules.locked` in the shared
 * store, which is what unlocks Activity's poisoned-invoice simulation for the rest of the demo.
 */
export function Rules() {
  const { state, lockRules, syncRulesFromChain } = useStore();
  const { rules } = state;

  // The screen only ever calls this "Locked" once the real onchain record backs it up —
  // never from the click alone. Best-effort: a stale read leaves the button ready to retry.
  useEffect(() => {
    void syncRulesFromChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = rules.lockStatus === 'connecting' || rules.lockStatus === 'writing' || rules.lockStatus === 'locking';

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Spending Rules</h1>
      <p className="mb-5 text-sm text-muted-foreground">Sets PayableAgent’s enforceable spending scope.</p>

      <Card>
        <CardContent className="p-5">
          <div className="mb-5 max-w-sm">
            <StatTile label="Budget cap" value={money(rules.budgetCap)} caption="per transaction" />
          </div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Approved vendors
          </div>
          <div className="mb-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody>
                {rules.vendors.map((v) => (
                  <tr key={v.account} className="border-b border-border/70">
                    <td className="p-3 text-sm font-semibold">{v.name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{v.account}</td>
                    <td className="p-3 text-right">
                      <Badge variant="success">Approved</Badge>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="p-3 text-sm text-muted-foreground/70" colSpan={3}>
                    + add vendor <span className="text-xs">(fixed for this demo)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {rules.locked ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 rounded-lg bg-[var(--success)]/10 px-3 py-2 text-sm font-semibold text-[var(--success)]">
                <CheckIcon /> Locked on ENS — cannot be silently changed <Badge variant="ens">ENS</Badge>
              </div>
              <div className="flex flex-col gap-0.5 pl-1 font-mono text-xs text-muted-foreground">
                {rules.writeTxHash ? (
                  <a
                    className="underline decoration-dotted hover:text-foreground"
                    href={etherscanTxUrl(rules.writeTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    write tx: {rules.writeTxHash.slice(0, 10)}…
                  </a>
                ) : null}
                {rules.lockTxHash ? (
                  <a
                    className="underline decoration-dotted hover:text-foreground"
                    href={etherscanTxUrl(rules.lockTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    lock tx: {rules.lockTxHash.slice(0, 10)}…
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <Button onClick={() => void lockRules()} disabled={busy}>
                {LOCK_BUTTON_LABEL[rules.lockStatus] ?? LOCK_BUTTON_LABEL.idle}
              </Button>
              {rules.lockStatus === 'written' && rules.writeTxHash ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  <a
                    className="underline decoration-dotted hover:text-foreground"
                    href={etherscanTxUrl(rules.writeTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    write tx: {rules.writeTxHash.slice(0, 10)}…
                  </a>{' '}
                  — written, not yet locked
                </p>
              ) : null}
              {rules.lockStatus === 'error' && rules.lockError ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <Badge variant="destructive">Error</Badge> {rules.lockError}
                </p>
              ) : null}
            </div>
          )}

          {!rules.locked ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Not locked yet — simulating an attack on Activity stays disabled until these rules are locked.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
