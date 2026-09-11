import { describe, it, expect } from 'vitest';
import { payClaim } from '../transitions';
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

describe('payClaim', () => {
  it('marks an investigated, unpaid claim "approved" and deducts its amount from the pool balance', () => {
    const claim = buildClaim({ investigated: true, status: 'submitted', amount: 500 });

    const result = payClaim(claim, 48800);

    expect(result.claim.status).toBe('approved');
    expect(result.poolBalance).toBe(48300);
  });

  it('returns a not-yet-investigated claim unchanged and leaves the pool balance untouched', () => {
    const claim = buildClaim({ investigated: false, status: 'submitted' });

    const result = payClaim(claim, 48800);

    expect(result.claim).toEqual(claim);
    expect(result.poolBalance).toBe(48800);
  });

  it('returns an already-approved claim unchanged and leaves the pool balance untouched (no double-deduction)', () => {
    const claim = buildClaim({ investigated: true, status: 'approved' });

    const result = payClaim(claim, 48800);

    expect(result.claim).toEqual(claim);
    expect(result.poolBalance).toBe(48800);
  });
});
