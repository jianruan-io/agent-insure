import { describe, it, expect } from 'vitest';
import { computeClaimStats, getRecentPayouts } from '../stats';
import type { Claim } from '../types';

function buildClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'c1',
    vendor: 'Acme Corp',
    amount: 500,
    account: '0.0.10465722',
    status: 'submitted',
    investigated: false,
    verdict: null,
    reasoning: 'looks off',
    ...overrides,
  };
}

describe('computeClaimStats', () => {
  it('counts every claim as filed, regardless of status', () => {
    const claims = [buildClaim({ id: 'c1' }), buildClaim({ id: 'c2', status: 'approved' })];

    expect(computeClaimStats(claims).filed).toBe(2);
  });

  it('counts only claims with status "approved" as paid', () => {
    const claims = [
      buildClaim({ id: 'c1', status: 'submitted' }),
      buildClaim({ id: 'c2', status: 'approved' }),
      buildClaim({ id: 'c3', status: 'approved' }),
    ];

    expect(computeClaimStats(claims).paid).toBe(2);
  });

  it('reports zero filed and zero paid for an empty claims list', () => {
    expect(computeClaimStats([])).toEqual({ filed: 0, paid: 0 });
  });
});

describe('getRecentPayouts', () => {
  it('returns only claims with status "approved"', () => {
    const claims = [
      buildClaim({ id: 'c1', status: 'submitted' }),
      buildClaim({ id: 'c2', status: 'approved' }),
    ];

    const result = getRecentPayouts(claims);

    expect(result.map((c) => c.id)).toEqual(['c2']);
  });

  it('orders the returned claims most-recently-paid first', () => {
    const claims = [
      buildClaim({ id: 'first-paid', status: 'approved' }),
      buildClaim({ id: 'second-paid', status: 'approved' }),
    ];

    const result = getRecentPayouts(claims);

    expect(result.map((c) => c.id)).toEqual(['second-paid', 'first-paid']);
  });

  it('returns an empty list when there are no approved claims', () => {
    const claims = [buildClaim({ id: 'c1', status: 'submitted' })];

    expect(getRecentPayouts(claims)).toEqual([]);
  });
});
