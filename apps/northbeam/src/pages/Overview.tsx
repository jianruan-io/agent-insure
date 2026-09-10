import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { StatTile } from '../components/StatTile';
import { useStore } from '../lib/store.js';

const ENS_NAME = 'payableagent.northbeam.eth';

/** Hand-drawn stroke SVGs matching the approved Northbeam Portal prototype's icon set —
 *  never an icon-library glyph or emoji — mirroring the convention already established
 *  in AppSidebar.tsx. */
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7.3" />
      <line x1="10" y1="9" x2="10" y2="14" />
      <circle cx="10" cy="6.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IdCardIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="12" r="2" />
      <line x1="14" y1="10" x2="18" y2="10" />
      <line x1="14" y1="14" x2="18" y2="14" />
    </svg>
  );
}

function CertificateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
      <path d="M11 2.5v4h4" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="7.5" x2="12" y2="8.8" />
    </svg>
  );
}

function money(amount: number) {
  return `$${amount.toLocaleString()}`;
}

type PipelineTone = 'world' | 'ens' | 'hedera';

interface PipelineStepProps {
  tone: PipelineTone;
  icon: React.ReactNode;
  title: string;
  description: string;
  isLast?: boolean;
}

/** One step of the "How this policy exists" timeline. The icon's fill/text colors are
 *  the fixed sponsor tag tokens (`--world`, `--ens`, `--hedera` and their `-fill`
 *  counterparts) — set via inline style rather than a Tailwind class because the tone is
 *  chosen at runtime per step, and Tailwind can't statically extract a class built from a
 *  template string. */
function PipelineStep({ tone, icon, title, description, isLast = false }: PipelineStepProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `var(--${tone}-fill)`,
            color: `var(--${tone})`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${tone}) 35%, transparent)`,
          }}
        >
          {icon}
        </span>
        {isLast ? null : <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={isLast ? '' : 'pb-5'}>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 max-w-md text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

/**
 * Northbeam's Overview screen — what any counterparty sees when it looks up PayableAgent
 * before deciding whether to trust it. Reproduces the published prototype's
 * `screenOverview()` at 1:1 content/structure parity: the ENS-published banner, the four
 * coverage/policy/claims stat tiles, the three-step "how this policy exists" pipeline,
 * and the recent-activity table. Values now come from the shared store (`useStore`)
 * instead of the old static seed-data.ts import, so locking rules on `/rules` or
 * simulating an invoice on `/activity` is reflected here immediately.
 */
export function Overview() {
  const { state } = useStore();
  const { rules, activity, claims } = state;
  const [copyLabel, setCopyLabel] = useState('Copy');

  function handleCopyEns() {
    try {
      // Matches the prototype's own behavior: the write is best-effort — a denied
      // clipboard permission or insecure context still shows "Copied!" below, it just
      // silently doesn't put anything on the clipboard.
      void navigator.clipboard.writeText(ENS_NAME).catch(() => {});
    } catch {
      // no-op
    }
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy'), 1200);
  }

  const filed = claims.length;
  const paid = claims.filter((c) => c.status === 'approved').length;
  const recent = activity.slice(-3).reverse();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Overview</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        What any counterparty sees when it looks up PayableAgent — before deciding whether to trust it.
      </p>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <span className="mt-0.5 shrink-0 text-primary">
          <InfoIcon />
        </span>
        <div>
          Published on ENS —{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">{ENS_NAME}</code>{' '}
          <button type="button" className="ml-1 font-semibold text-primary hover:underline" onClick={handleCopyEns}>
            {copyLabel}
          </button>
          . Any counterparty can verify this policy before transacting with PayableAgent.
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Coverage limit" value={money(rules.budgetCap)} caption="per-transaction cap" />
        <StatTile
          label="Policy status"
          value={rules.locked ? 'Active' : 'Pending'}
          caption={rules.locked ? 'locked on ENS' : 'rules not yet locked'}
          valueClassName={rules.locked ? 'text-[var(--success)]' : 'text-[var(--warning)]'}
        />
        <StatTile label="Claims filed" value={filed} caption="lifetime" />
        <StatTile label="Claims paid" value={paid} caption="lifetime" />
      </div>

      <Card className="mb-5">
        <CardContent className="p-5">
          <h3 className="mb-4 text-sm font-bold">How this policy exists</h3>
          <PipelineStep
            tone="world"
            icon={<IdCardIcon />}
            title="Underwriting"
            description="World verifies the real human behind PayableAgent before any policy can be created."
          />
          <PipelineStep
            tone="ens"
            icon={<CertificateIcon />}
            title="Certificate"
            description="ENS publishes the coverage limit and vendor mandate as the enforceable, public record."
          />
          <PipelineStep
            tone="hedera"
            icon={<VaultIcon />}
            title="Claims + vault"
            description="Hedera logs every action and holds the reserve pool the payout is drawn from at Agent Insure."
            isLast
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-bold">Recent activity</h3>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/activity">View all →</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2 pb-2 pt-0">
          <table className="w-full text-sm">
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-border/70 last:border-0">
                  <td className="p-2.5 text-xs text-muted-foreground">{a.time}</td>
                  <td className="p-2.5 text-sm">{a.flagged ? `“${a.vendor}”` : a.vendor}</td>
                  <td className="p-2.5 text-right text-sm tabular-nums">{money(a.amount)}</td>
                  <td className="p-2.5 text-right">
                    <Badge variant={a.flagged ? 'destructive' : 'success'}>{a.flagged ? 'Flagged' : 'OK'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
