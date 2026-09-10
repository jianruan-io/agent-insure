import { describe, it, expect } from 'vitest';

const { buildCoverageFeeRequirements, hasValidPaymentHeader } = await import('../coverage-fee.js');

describe('buildCoverageFeeRequirements', () => {
  it('builds a well-formed Blocky402-compatible payment-requirements object', () => {
    const requirements = buildCoverageFeeRequirements({
      amount: '100000',
      payToAccountId: '0.0.7000001',
      asset: '0.0.429274',
    });

    expect(requirements.scheme).toBe('exact');
    expect(requirements.network).toBe('hedera:testnet');
    expect(requirements.payTo).toBe('0.0.7000001');
    expect(requirements.asset).toBe('0.0.429274');
    expect(requirements.amount).toBe('100000');
  });

  it('rejects a zero or missing fee amount instead of silently charging nothing', () => {
    expect(() => buildCoverageFeeRequirements({ amount: '0', payToAccountId: '0.0.7000001', asset: '0.0.429274' })).toThrow();
    expect(() => buildCoverageFeeRequirements({ payToAccountId: '0.0.7000001', asset: '0.0.429274' })).toThrow();
  });
});

describe('hasValidPaymentHeader', () => {
  it('detects a well-formed X-PAYMENT header as carrying payment', () => {
    const req = { headers: { 'x-payment': Buffer.from(JSON.stringify({ x402Version: 1 })).toString('base64') } };

    expect(hasValidPaymentHeader(req)).toBe(true);
  });

  it('detects a missing X-PAYMENT header as not carrying payment', () => {
    const req = { headers: {} };

    expect(hasValidPaymentHeader(req)).toBe(false);
  });

  it('detects a malformed X-PAYMENT header as not carrying payment, never as paid', () => {
    const req = { headers: { 'x-payment': 'not-valid-base64-json!!' } };

    expect(hasValidPaymentHeader(req)).toBe(false);
  });
});
