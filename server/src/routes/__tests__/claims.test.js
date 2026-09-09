import { describe, it, expect } from 'vitest';

const { createClaim } = await import('../claims.js');

function buildInput(overrides = {}) {
  return {
    vendor: 'Acme Corp',
    amount: 500,
    activityId: 'a1',
    ...overrides,
  };
}

describe('createClaim', () => {
  it('creates a claim record with a fresh id, the given vendor/amount/activityId, and a draft status', () => {
    const claim = createClaim(buildInput());

    expect(claim.id).toBeTruthy();
    expect(claim.vendor).toBe('Acme Corp');
    expect(claim.amount).toBe(500);
    expect(claim.activityId).toBe('a1');
    expect(claim.status).toBe('draft');
  });

  it('gives each new claim a different id from the one before it', () => {
    const first = createClaim(buildInput());
    const second = createClaim(buildInput());

    expect(second.id).not.toBe(first.id);
  });
});
