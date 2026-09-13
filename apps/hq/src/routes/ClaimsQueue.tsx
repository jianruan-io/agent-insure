import { useState } from 'react';
import { Button } from '../components/ui/button';
import type { Claim } from '../lib/claims/types';

function money(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

/** Same real HashScan link convention as apps/business's Activity feed — never guessed,
 *  confirmed by actually resolving a real transaction there. */
function hashscanTxUrl(transactionId: string): string {
  return `https://hashscan.io/testnet/transaction/${transactionId}`;
}

// payableagent.agentinsure.eth is a real, registered ENS subname — the same one
// InvestigatorAgent's ENS read (readApprovedAccount) actually queries. Its Records tab
// shows the real, locked vendor account directly, independently of anything this app says.
function ensNameExplorerUrl(): string {
  return 'https://hackathon-deployment-portal-app.ens-cf.workers.dev/payableagent.agentinsure.eth/records';
}

function StatusBadge({ claim }: { claim: Claim }) {
  if (claim.status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
        Paid
      </span>
    );
  }
  if (claim.investigated) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
        Investigated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
      New
    </span>
  );
}

interface ClaimDetailProps {
  claim: Claim;
  onInvestigate: (claimId: string) => void;
  onPay: (claimId: string) => void;
}

function ClaimDetail({ claim, onInvestigate, onPay }: ClaimDetailProps) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold">
          Claim #{claim.id} — {claim.vendor}
        </h3>
        <span className="text-sm tabular-nums text-muted-foreground">{money(claim.amount)}</span>
      </div>

      <div className="mb-5">
        {claim.investigated ? (
          <>
            <span
              className={`inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium ${
                claim.verdict === 'FRAUD' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
              }`}
            >
              VERDICT: {claim.verdict}
            </span>
            <div className="mt-2 text-xs text-muted-foreground">{claim.reasoning}</div>
            <a
              className="mt-1 inline-block font-mono text-[11px] text-muted-foreground underline hover:text-foreground"
              href={ensNameExplorerUrl()}
              target="_blank"
              rel="noreferrer"
            >
              verify the locked vendor account on ENS
            </a>
          </>
        ) : (
          <Button size="sm" onClick={() => onInvestigate(claim.id)}>
            Run Investigation
          </Button>
        )}
      </div>

      {claim.investigated && (
        <div>
          {claim.status === 'approved' && claim.payoutTxHash ? (
            <a
              href={hashscanTxUrl(claim.payoutTxHash)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground underline"
            >
              Hedera tx ({money(claim.amount)} mUSDC): {claim.payoutTxHash}
            </a>
          ) : claim.verdict === 'FRAUD' ? (
            <Button size="sm" onClick={() => onPay(claim.id)}>
              Run Payout
            </Button>
          ) : (
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Not payable — no fraud confirmed, nothing to reimburse.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ClaimsQueueProps {
  claims: Claim[];
  onInvestigate: (claimId: string) => void;
  onPay: (claimId: string) => void;
}

export default function ClaimsQueue({ claims, onInvestigate, onPay }: ClaimsQueueProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | undefined>(claims[0]?.id);
  const selectedClaim = claims.find((c) => c.id === selectedClaimId) ?? claims[0];
  const orderedClaims = claims.slice().reverse();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Claims Queue</h1>
      <p className="mb-5 text-sm text-muted-foreground">Investigate disputed payments and authorize payouts.</p>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
          <div className="space-y-1.5 border-b border-border p-3 md:border-b-0 md:border-r">
            {orderedClaims.map((claim) => (
              <button
                key={claim.id}
                type="button"
                onClick={() => setSelectedClaimId(claim.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedClaimId === claim.id ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/60'
                }`}
              >
                <span className="font-semibold">#{claim.id} Northbeam</span>
                <StatusBadge claim={claim} />
              </button>
            ))}
          </div>
          <div>
            {selectedClaim ? (
              <ClaimDetail claim={selectedClaim} onInvestigate={onInvestigate} onPay={onPay} />
            ) : (
              <div className="p-5 text-sm text-muted-foreground">Select a claim from the list.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
