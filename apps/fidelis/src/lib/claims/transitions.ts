import type { Claim } from './types';

export function investigateClaim(claim: Claim): Claim {
  if (claim.investigated) return claim;
  return { ...claim, investigated: true, verdict: 'FRAUD' };
}

export function payClaim(claim: Claim, poolBalance: number): { claim: Claim; poolBalance: number } {
  if (!claim.investigated || claim.status === 'approved') {
    return { claim, poolBalance };
  }
  return { claim: { ...claim, status: 'approved' }, poolBalance: poolBalance - claim.amount };
}
