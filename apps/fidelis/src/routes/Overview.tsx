import { CheckCircle2, IdCard, Info, Vault } from 'lucide-react';
import { StatTile } from '../components/StatTile';
import { computeClaimStats, getRecentPayouts } from '../lib/claims/stats';
import type { Claim } from '../lib/claims/types';

function money(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

const PIPELINE_STEPS = [
  {
    icon: Vault,
    title: 'Pull the evidence',
    description: "InvestigatorAgent reads Hedera Mirror Node history and the locked ENS rules.",
  },
  {
    icon: IdCard,
    title: 'Sign a verdict',
    description: 'A real judgment call on whether the payment looks like manipulation.',
  },
  {
    icon: CheckCircle2,
    title: 'Verify + pay',
    description: 'PayoutAgent independently checks the verdict, then pays from the pool.',
  },
];

interface OverviewProps {
  claims: Claim[];
  poolBalance: number;
}

export default function Overview({ claims, poolBalance }: OverviewProps) {
  const stats = computeClaimStats(claims);
  const recentPayouts = getRecentPayouts(claims);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Overview</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        The insurer's side — pool health and how claims get judged.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Reserve pool" value={money(poolBalance)} caption="available to pay claims" />
        <StatTile label="Claims filed" value={stats.filed} caption="across all policies" />
        <StatTile label="Claims paid" value={stats.paid} caption="lifetime" />
        <StatTile label="Active policies" value={1} caption="Northbeam Distributors" />
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          Every payout draws from this shared pool only after InvestigatorAgent signs a verdict{' '}
          <em>and</em> PayoutAgent independently verifies it — no single agent can pay itself.
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold">How a claim gets paid</h3>
        <div className="space-y-5">
          {PIPELINE_STEPS.map((step) => (
            <div key={step.title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">{step.title}</div>
                <div className="mt-0.5 max-w-md text-xs text-muted-foreground">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-bold">Recent payouts</h3>
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full text-sm">
            <tbody>
              {recentPayouts.length === 0 ? (
                <tr>
                  <td className="p-2.5 text-sm text-muted-foreground" colSpan={3}>
                    No payouts yet.
                  </td>
                </tr>
              ) : (
                recentPayouts.map((claim) => (
                  <tr key={claim.id} className="border-b border-border/70 last:border-0">
                    <td className="p-2.5 text-sm">
                      #{claim.id} {claim.vendor}
                    </td>
                    <td className="p-2.5 text-right text-sm tabular-nums">{money(claim.amount)}</td>
                    <td className="p-2.5 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        Paid
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
