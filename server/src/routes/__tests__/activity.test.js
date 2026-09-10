import { describe, it, expect } from 'vitest';

const { selectPoisonedPaymentTarget, buildActivityRow, classifyPaymentError } = await import('../activity.js');

function buildVendor(overrides = {}) {
  return { name: 'Acme Corp', hederaAccountId: '0.0.7000002', ...overrides };
}

describe('selectPoisonedPaymentTarget', () => {
  it('routes to the configured wrong account, never the vendor\'s own locked account', () => {
    const vendor = buildVendor();
    const target = selectPoisonedPaymentTarget({ vendor, wrongAccountId: '0.0.6666666', amount: 500 });

    expect(target.accountId).toBe('0.0.6666666');
    expect(target.accountId).not.toBe(vendor.hederaAccountId);
    expect(target.amount).toBe(500);
  });
});

describe('buildActivityRow', () => {
  function buildReceipts(overrides = {}) {
    return {
      vendor: 'Acme Corp',
      accountId: '0.0.7000002',
      amount: 500,
      feeAmount: '100000',
      feeReceipt: { transaction: '0.0.1@1700000000.000000001' }, // SettleResponse's real field name
      paymentReceipt: { transactionId: '0.0.1@1700000000.000000002' }, // Hedera SDK receipt's real field name
      hcsSequenceNumber: 42,
      ...overrides,
    };
  }

  it('produces a row with the real amount, fee, destination account, and both transaction hashes', () => {
    const row = buildActivityRow(buildReceipts());

    expect(row.vendor).toBe('Acme Corp');
    expect(row.account).toBe('0.0.7000002');
    expect(row.amount).toBe(500);
    expect(row.feeAmount).toBe('100000');
    expect(row.feeTxHash).toBe('0.0.1@1700000000.000000001');
    expect(row.paymentTxHash).toBe('0.0.1@1700000000.000000002');
    expect(row.hcsSequenceNumber).toBe(42);
  });

  it('raises rather than producing a row with a blank transaction hash', () => {
    expect(() => buildActivityRow(buildReceipts({ paymentReceipt: {} }))).toThrow();
  });

  it('raises rather than producing a row with no real destination account', () => {
    expect(() => buildActivityRow(buildReceipts({ accountId: undefined }))).toThrow();
  });
});

describe('classifyPaymentError', () => {
  it('classifies a failure during the coverage-fee charge as the fee-failed state', () => {
    expect(classifyPaymentError(new Error('boom'), 'fee')).toBe('fee-charge-failed');
  });

  it('classifies a failure during the vendor transfer as the payment-failed state', () => {
    expect(classifyPaymentError(new Error('boom'), 'payment')).toBe('vendor-payment-failed');
  });

  it('falls back to a generic failure state for an unrecognized error shape, never throws', () => {
    expect(() => classifyPaymentError('a plain string error', 'payment')).not.toThrow();
    expect(classifyPaymentError(undefined, 'unknown-stage')).toBe('unknown');
  });
});
