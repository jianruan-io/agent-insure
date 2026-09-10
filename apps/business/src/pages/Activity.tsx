import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { useStore, type ActivityEntry } from '../lib/store.js';

function money(amount: number) {
  return `$${amount.toLocaleString()}`;
}

/** Real proof lives on Hedera's own public explorer — verified against Hedera's docs,
 *  not guessed: https://hashscan.io/testnet/transaction/<transactionId>. */
function hashscanTxUrl(transactionId: string): string {
  return `https://hashscan.io/testnet/transaction/${transactionId}`;
}

/** The x402 coverage fee is charged in HEDERA_TESTNET_USDC, a 6-decimal token — the raw
 *  amount PayableAgent's backend sends (e.g. "10000") is 0.01 USDC, not $0.01 of HBAR. */
function formatFeeAmount(rawAmount: string): string {
  return `$${(Number(rawAmount) / 1_000_000).toFixed(2)} USDC`;
}

/** One row of the Activity Feed table, plus its collapsible reasoning row underneath —
 *  mirrors the published prototype's `activityRow()`. */
function ActivityRow({ entry, onToggleReason }: { entry: ActivityEntry; onToggleReason: (id: string) => void }) {
  const hasRealProof = Boolean(entry.feeTxHash && entry.paymentTxHash);
  return (
    <>
      <tr className="border-b border-border/70 last:border-0 hover:bg-muted/40">
        <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{entry.time}</td>
        <td className="p-3 text-sm">
          {entry.flagged ? `“${entry.vendor}”` : entry.vendor}
          <div className="font-mono text-xs text-muted-foreground">{entry.account}</div>
          {entry.flagged ? (
            <div className="text-xs text-destructive">
              new account, never used before{entry.claimed ? ' · claim filed' : ''}
            </div>
          ) : null}
        </td>
        <td className="p-3 text-right text-sm tabular-nums">{money(entry.amount)}</td>
        <td className="p-3 text-right text-xs tabular-nums text-muted-foreground">
          {hasRealProof ? (
            <a
              className="underline decoration-dotted hover:text-foreground"
              href={hashscanTxUrl(entry.feeTxHash!)}
              target="_blank"
              rel="noreferrer"
            >
              {formatFeeAmount(entry.feeAmount!)}
            </a>
          ) : (
            '$0.02'
          )}{' '}
          <Badge variant="hedera">Hedera</Badge>
        </td>
        <td className="p-3 text-right">
          <Badge variant={entry.flagged ? 'destructive' : 'success'}>{entry.flagged ? 'Flagged' : 'OK'}</Badge>
        </td>
        <td className="p-3 text-right">
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline"
            onClick={() => onToggleReason(entry.id)}
          >
            {entry.expanded ? 'hide' : 'reason'}
          </button>
        </td>
      </tr>
      {entry.expanded ? (
        <tr className="border-b border-border/70 bg-muted/30">
          <td className="p-3 text-xs text-muted-foreground" colSpan={6}>
            <div>{entry.reasoning}</div>
            {hasRealProof ? (
              <div className="mt-2 flex flex-col gap-0.5 font-mono text-[11px]">
                <a
                  className="underline decoration-dotted hover:text-foreground"
                  href={hashscanTxUrl(entry.paymentTxHash!)}
                  target="_blank"
                  rel="noreferrer"
                >
                  vendor payment tx: {entry.paymentTxHash!.slice(0, 18)}…
                </a>
                {entry.hcsSequenceNumber ? <span>logged to Hedera Consensus Service · seq #{entry.hcsSequenceNumber}</span> : null}
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * Northbeam's Activity screen — every payment PayableAgent makes, logged on Hedera.
 * Reproduces the published prototype's `screenActivity()`: the normal/poisoned invoice
 * simulation buttons (both disabled until rules are locked; the attack button additionally
 * disabled while an unclaimed flagged payment already exists, so there's never more than
 * one open dispute at a time) and the reverse-chronological feed table.
 */
export function Activity() {
  const { state, simulateNormalInvoice, simulatePoisonedInvoice, toggleReason } = useStore();
  const { rules, activity, activitySimulating, activitySimulateError } = state;
  const hasOpenFlag = activity.some((a) => a.flagged && !a.claimed);
  const rows = activity.slice().reverse();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Activity Feed</h1>
          <p className="text-sm text-muted-foreground">Every payment PayableAgent makes, logged on Hedera.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!rules.locked || activitySimulating}
            onClick={() => void simulateNormalInvoice()}
          >
            {activitySimulating ? 'Paying…' : 'Simulate normal invoice'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!rules.locked || hasOpenFlag || activitySimulating}
            onClick={() => void simulatePoisonedInvoice()}
          >
            {activitySimulating ? 'Paying…' : 'Simulate poisoned invoice'}
          </Button>
        </div>
      </div>

      {!rules.locked ? (
        <div className="mb-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Lock spending rules first — there’s nothing to flag a bad payment against yet.
        </div>
      ) : null}

      {activitySimulateError ? (
        <p className="mb-4 flex items-center gap-1.5 text-sm font-medium text-destructive">
          <Badge variant="destructive">Error</Badge> {activitySimulateError}
        </p>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="p-3 font-semibold">Time</th>
                <th className="p-3 font-semibold">Payment</th>
                <th className="p-3 text-right font-semibold">Amount</th>
                <th className="p-3 text-right font-semibold">Fee</th>
                <th className="p-3 text-right font-semibold">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} onToggleReason={toggleReason} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
