import { describe, it, expect } from 'vitest';
import { investigateClaim, payClaim } from '../transitions';
import type { Claim } from '../types';

function buildClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'c1',
    vendor: 'Acme Corp',
    amount: 500,
    time: '12 minutes ago',
    status: 'submitted',
    investigated: false,
    verdict: null,
    reasoning: 'looks off',
    ...overrides,
  };
}

describe('investigateClaim', () => {
  it('marks an un-investigated claim investigated, with a verdict and reasoning set', () => {
    const claim = buildClaim({ investigated: false, verdict: null });

    const result = investigateClaim(claim);

    expect(result.investigated).toBe(true);
    expect(result.verdict).toBe('FRAUD');
    expect(result.reasoning).toBe(claim.reasoning);
  });

  it('returns an already-investigated claim unchanged', () => {
    const claim = buildClaim({ investigated: true, verdict: 'FRAUD' });

    const result = investigateClaim(claim);

    expect(result).toEqual(claim);
  });
});

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
