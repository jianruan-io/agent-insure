import type { Claim } from './types';

export function computeClaimStats(claims: Claim[]): { filed: number; paid: number } {
  return {
    filed: claims.length,
    paid: claims.filter((c) => c.status === 'approved').length,
  };
}

export function getRecentPayouts(claims: Claim[]): Claim[] {
  return claims.filter((c) => c.status === 'approved').slice().reverse();
}
