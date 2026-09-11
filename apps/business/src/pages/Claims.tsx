import { useState, type ReactNode } from 'react';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { SelfieModal } from '../components/SelfieModal.js';
import { useStore, type ClaimEntry } from '../lib/store.js';

function money(amount: number) {
  return `$${amount.toLocaleString()}`;
}

/** Real proof lives on Hedera's own public explorer — same convention as Activity.tsx. */
function hashscanTxUrl(transactionId: string): string {
  return `https://hashscan.io/testnet/transaction/${transactionId}`;
}

/** Hand-drawn stroke SVG matching the approved Northbeam Portal prototype's check icon —
 *  same convention as Rules.tsx/AppSidebar.tsx/Overview.tsx. */
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

/** One claim card — body varies by status, mirroring the published prototype's
 *  `claimCard()`: a face-scan prompt while `awaiting-identity`, a waiting line once
 *  `submitted`, or the resolved payout line once `approved` (the seeded historical claim). */
function ClaimCard({ claim, onStartSelfie }: { claim: ClaimEntry; onStartSelfie: (id: string) => void }) {
  let body: ReactNode;
  if (claim.status === 'awaiting-identity') {
    body = (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-3">
        <span className="text-sm">
          🧑 Live Selfie Check required <Badge variant="world">World</Badge>
        </span>
        <Button size="sm" onClick={() => onStartSelfie(claim.id)}>
          Start face scan
        </Button>
      </div>
    );
  } else if (claim.status === 'submitted') {
    body = (
      <div className="text-sm text-muted-foreground">
        ⏳ Submitted — now with Agent Insure for investigation
      </div>
    );
  } else {
    body = (
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
          <CheckIcon /> Approved — {money(claim.amount)} returned <Badge variant="hedera">Hedera</Badge>
        </div>
        {claim.payoutTxHash ? (
          <a
            href={hashscanTxUrl(claim.payoutTxHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block font-mono text-xs text-muted-foreground underline"
          >
            Hedera tx: {claim.payoutTxHash}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="mb-3">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>
            #{claim.id} {claim.vendor} payment
          </span>
          <span className="text-xs font-normal text-muted-foreground">{claim.time}</span>
        </div>
        {body}
      </div>
    </Card>
  );
}

/**
 * Northbeam's Claims screen — disputed payments filed against this policy. Reproduces the
 * published prototype's `screenClaims()`: filing is enabled only when a
 * flagged-and-unclaimed activity row exists (filing marks that row claimed and creates a
 * new `awaiting-identity` claim), and starting a claim's face scan opens SelfieModal, whose
 * Continue action moves that claim to `submitted`.
 */
export function Claims() {
  const { state, fileClaim, completeSelfie } = useStore();
  const { activity, claims } = state;
  const [selfieClaimId, setSelfieClaimId] = useState<string | null>(null);
  const [fileClaimError, setFileClaimError] = useState<string | null>(null);

  const eligible = activity.find((a) => a.flagged && !a.claimed);
  const cards = claims.slice().reverse();
  // Re-derived from the current claims list (not just the id) so a demo reset mid-scan
  // can't leave the modal pointing at a claim that no longer exists.
  const selfieClaim = selfieClaimId ? claims.find((c) => c.id === selfieClaimId) : undefined;

  async function handleFileClaim() {
    if (!eligible) return;
    setFileClaimError(null);
    try {
      await fileClaim(eligible.id);
    } catch {
      setFileClaimError('Could not file the claim — the backend is unreachable. Try again.');
    }
  }

  function handleCompleteSelfie() {
    if (selfieClaim) completeSelfie(selfieClaim.id);
    setSelfieClaimId(null);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Claims</h1>
          <p className="text-sm text-muted-foreground">Disputed payments filed against this policy.</p>
        </div>
        <Button disabled={!eligible} onClick={handleFileClaim}>
          + File a Claim
        </Button>
      </div>

      {!eligible ? (
        <div className="mb-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          No disputed payment yet — simulate a poisoned invoice on Activity first.
        </div>
      ) : null}

      {fileClaimError ? (
        <div className="mb-4 rounded-lg border border-dashed border-red-300 bg-red-50 p-3 text-xs text-red-600">
          ⚠️ {fileClaimError}
        </div>
      ) : null}

      <div>
        {cards.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} onStartSelfie={setSelfieClaimId} />
        ))}
      </div>

      {selfieClaim ? <SelfieModal onClose={() => setSelfieClaimId(null)} onComplete={handleCompleteSelfie} /> : null}
    </div>
  );
}
