import { useState } from 'react';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { useStore, type ActivityEntry, type ClaimEntry } from '../lib/store.js';

function money(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The server derives every row's `time` from the real vendor payment transaction's own
 *  consensus timestamp — rendered in the viewer's own local time, never a placeholder
 *  like "Just now". If this ever renders "Invalid Date", it's stale browser data from
 *  before this — click "Reset Demo" to clear it. */
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Real proof lives on Hedera's own public explorer — verified against Hedera's docs,
 *  not guessed: https://hashscan.io/testnet/transaction/<transactionId>. */
function hashscanTxUrl(transactionId: string): string {
  return `https://hashscan.io/testnet/transaction/${transactionId}`;
}

/** Every Hedera account has its own real, public HashScan page — balance, memo, and its
 *  own transaction history, independent of anything this app says about it. */
function hashscanAccountUrl(accountId: string): string {
  return `https://hashscan.io/testnet/account/${accountId}`;
}

/** A single, generic modal shell — every "View …" column opens one of these rather than
 *  stacking its content inline into the row. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card p-6 shadow-[0_12px_32px_rgba(0,0,0,.16)]">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The real invoice document PayableAgent read, rendered exactly as authored — on a
 *  poisoned row, a concealed instruction stays visually invisible against the document's
 *  own white background, same as it was for PayableAgent, until selected. Every row has
 *  one — the clean invoice is a real artifact too, not just the poisoned one. */
function InvoiceModal({ entry, onClose }: { entry: ActivityEntry; onClose: () => void }) {
  return (
    <Modal title={`Invoice as PayableAgent read it — ${entry.flagged ? 'poisoned' : 'normal'}`} onClose={onClose}>
      {entry.flagged ? (
        <p className="mb-3 shrink-0 text-xs text-muted-foreground">
          Select all (⌘/Ctrl+A) inside the invoice below to reveal any concealed text.
        </p>
      ) : null}
      <div
        data-testid="invoice-modal"
        className="min-h-0 overflow-y-auto rounded-lg border border-border bg-white p-4 text-black"
        dangerouslySetInnerHTML={{ __html: entry.invoiceHtml! }}
      />
    </Modal>
  );
}

/**
 * The real x402 protocol exchange behind this row's insurance payment. Two clearly
 * separate things, never merged: the protocol payload itself (the raw request/response
 * JSON this HTTP exchange actually produced) versus the onchain proof that it was really
 * paid (a link to the real settlement transaction on HashScan, not just this payload
 * saying `success: true`).
 */
function X402Modal({ entry, onClose }: { entry: ActivityEntry; onClose: () => void }) {
  const x402 = entry.x402!;
  const requirements = x402.challenge.accepts[0];
  const rawChallenge = {
    x402Version: x402.challenge.x402Version,
    accepts: [
      {
        scheme: requirements?.scheme,
        network: requirements?.network,
        asset: requirements?.asset,
        payTo: requirements?.payTo,
        amount: requirements?.amount,
        extra: { feePayer: requirements?.extra?.feePayer },
      },
    ],
  };
  return (
    <Modal title="x402 insurance payment" onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-1 font-mono text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">POST /api/coverage/charge</span>
        <span>→</span>
        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">402 Payment Required</span>
        <span>→</span>
        <span className="rounded bg-muted px-1.5 py-0.5">signed by PayableAgent</span>
        <span>→</span>
        <span className="rounded bg-muted px-1.5 py-0.5">verified by Blocky402</span>
        <span>→</span>
        <span className={`rounded px-1.5 py-0.5 ${x402.settlement.success ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-destructive/10 text-destructive'}`}>
          {x402.settlement.success ? 'settled' : 'settlement failed'}
        </span>
      </div>

      <div className="mb-4 rounded-lg border border-border p-3">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          1. Protocol payload — the raw HTTP exchange
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          The real 402 challenge <code>/api/coverage/charge</code> returned before any payment was attached:
        </p>
        <pre className="overflow-x-auto rounded bg-muted/60 p-2 font-mono text-[10px] leading-snug text-muted-foreground">
          {JSON.stringify(rawChallenge, null, 2)}
        </pre>
      </div>

      <div className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 p-3">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--success)]">
          2. Onchain proof — the real settlement
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Not just this payload's own <code>success: true</code> — the real transaction it produced, independently checkable on Hedera's own explorer:
        </p>
        <a
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          href={hashscanTxUrl(entry.insurancePaymentTxHash)}
          target="_blank"
          rel="noreferrer"
        >
          View the {money(entry.insurancePaymentUsd)} mUSDC settlement on HashScan →
        </a>
      </div>
    </Modal>
  );
}

type ActiveModal = { kind: 'invoice' | 'x402'; entryId: string } | null;

/** One row of the Activity Feed table — one column per datum, nothing combined into a
 *  shared cell. The vendor payment and the insurance payment are two entirely separate
 *  real transactions, always shown as two separate column pairs, never merged. Every
 *  column with a real onchain counterpart links straight to it. */
function ActivityRow({
  entry,
  claim,
  onOpenModal,
}: {
  entry: ActivityEntry;
  claim: ClaimEntry | undefined;
  onOpenModal: (modal: ActiveModal) => void;
}) {
  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-muted/40">
      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
        <a className="underline decoration-dotted hover:text-foreground" href={hashscanTxUrl(entry.vendorPaymentTxHash)} target="_blank" rel="noreferrer">
          {formatTimestamp(entry.time)}
        </a>
      </td>
      <td className="p-3 text-sm">{entry.vendor}</td>
      <td className="p-3 font-mono text-xs">
        <a className="underline decoration-dotted hover:text-foreground" href={hashscanAccountUrl(entry.account)} target="_blank" rel="noreferrer">
          {entry.account}
        </a>
      </td>
      <td className="p-3 text-right">
        {!entry.flagged ? (
          <Badge variant="success">OK</Badge>
        ) : claim?.status === 'approved' && claim.payoutTxHash ? (
          <a href={hashscanTxUrl(claim.payoutTxHash)} target="_blank" rel="noreferrer">
            <Badge variant="success">Reimbursed ✓</Badge>
          </a>
        ) : claim ? (
          <Badge variant="warning">Claim filed</Badge>
        ) : (
          <Badge variant="destructive">Flagged</Badge>
        )}
      </td>
      <td className="p-3 text-right text-sm tabular-nums">{money(entry.vendorPaymentUsd)}</td>
      <td className="p-3 text-xs tabular-nums">
        <a
          className="underline decoration-dotted hover:text-foreground"
          href={hashscanTxUrl(entry.vendorPaymentTxHash)}
          target="_blank"
          rel="noreferrer"
        >
          {entry.vendorPaymentTxHash.slice(0, 14)}…
        </a>
      </td>
      <td className="p-3 text-right text-sm tabular-nums text-muted-foreground">{money(entry.insurancePaymentUsd)}</td>
      <td className="p-3 text-xs tabular-nums">
        <a
          className="underline decoration-dotted hover:text-foreground"
          href={hashscanTxUrl(entry.insurancePaymentTxHash)}
          target="_blank"
          rel="noreferrer"
        >
          {entry.insurancePaymentTxHash.slice(0, 14)}…
        </a>
      </td>
      <td className="p-3 text-right">
        <button
          type="button"
          className="text-xs font-semibold text-primary hover:underline"
          onClick={() => onOpenModal({ kind: 'invoice', entryId: entry.id })}
        >
          View
        </button>
      </td>
      <td className="p-3 text-right">
        {entry.x402 ? (
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline"
            onClick={() => onOpenModal({ kind: 'x402', entryId: entry.id })}
          >
            View
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
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
  const { state, simulateNormalInvoice, simulatePoisonedInvoice } = useStore();
  const { rules, activity, claims, activitySimulating, activitySimulateError } = state;
  const hasOpenFlag = activity.some((a) => a.flagged && !a.claimed);
  const rows = activity.slice().reverse();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const activeEntry = activeModal ? activity.find((a) => a.id === activeModal.entryId) : undefined;

  return (
    <div className="mx-auto min-w-0 max-w-6xl">
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

      <Card className="min-w-0">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="p-3 font-semibold">Time</th>
                <th className="p-3 font-semibold">Counterparty</th>
                <th className="p-3 font-semibold">Hedera Address</th>
                <th className="p-3 text-right font-semibold">Status</th>
                <th className="p-3 text-right font-semibold">Vendor Payment ($)</th>
                <th className="p-3 font-semibold">Vendor Payment Tx</th>
                <th className="p-3 text-right font-semibold">Insurance Payment ($)</th>
                <th className="p-3 font-semibold">Insurance Payment Tx</th>
                <th className="p-3 text-right font-semibold">Invoice</th>
                <th className="p-3 text-right font-semibold">x402 Payload</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  claim={claims.find((c) => c.id === entry.claimId)}
                  onOpenModal={setActiveModal}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {activeModal?.kind === 'invoice' && activeEntry?.invoiceHtml ? (
        <InvoiceModal entry={activeEntry} onClose={() => setActiveModal(null)} />
      ) : null}
      {activeModal?.kind === 'x402' && activeEntry?.x402 ? (
        <X402Modal entry={activeEntry} onClose={() => setActiveModal(null)} />
      ) : null}
    </div>
  );
}
