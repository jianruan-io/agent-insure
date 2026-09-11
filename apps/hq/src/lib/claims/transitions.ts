import type { Claim } from './types';

export function payClaim(claim: Claim, poolBalance: number): { claim: Claim; poolBalance: number } {
  if (!claim.investigated || claim.status === 'approved') {
    return { claim, poolBalance };
  }
  return { claim: { ...claim, status: 'approved' }, poolBalance: poolBalance - claim.amount };
}
