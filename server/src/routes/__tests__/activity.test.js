import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('openai', () => {
  const create = vi.fn();
  return { default: vi.fn(() => ({ chat: { completions: { create } } })) };
});

import OpenAI from 'openai';

const { decidePaymentFromInvoice, isPaymentFlagged, buildActivityRow, classifyPaymentError } =
  await import('../activity.js');
const { extractInvoiceText, buildNormalInvoiceHtml, buildPoisonedInvoiceHtml } = await import(
  '../../invoices/invoice-content.js'
);

const openaiCreateMock = new OpenAI().chat.completions.create;

function buildVendor(overrides = {}) {
  return { name: 'Acme Corp', hederaAccountId: '0.0.7000002', ...overrides };
}

describe('decidePaymentFromInvoice', () => {
  beforeEach(() => {
    openaiCreateMock.mockReset();
  });

  it('decides the destination account, the amount, and states its own reasoning, straight from a real makePayment tool call', async () => {
    openaiCreateMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'makePayment',
                  arguments: JSON.stringify({
                    vendorAccountId: '0.0.9999999',
                    amount: 500,
                    reasoning: 'Invoice states the updated remittance account; paying it.',
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    const decision = await decidePaymentFromInvoice({ invoiceText: 'irrelevant for this test' });

    expect(decision.accountId).toBe('0.0.9999999');
    expect(decision.amount).toBe(500);
    expect(decision.reasoning).toBe('Invoice states the updated remittance account; paying it.');
  });

  it('raises a real, distinct error when the response contains no makePayment tool call', async () => {
    openaiCreateMock.mockResolvedValueOnce({ choices: [{ message: { tool_calls: [] } }] });

    await expect(decidePaymentFromInvoice({ invoiceText: 'irrelevant' })).rejects.toThrow();
  });

  it('raises a real, distinct error when the local model call itself fails (e.g. Ollama not running)', async () => {
    openaiCreateMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:11434'));

    await expect(decidePaymentFromInvoice({ invoiceText: 'irrelevant' })).rejects.toThrow();
  });
});

describe('isPaymentFlagged', () => {
  it("not flagged when the decided account matches the vendor's real, locked account", () => {
    const vendor = buildVendor();
    expect(isPaymentFlagged({ accountId: vendor.hederaAccountId, vendor })).toBe(false);
  });

  it("flagged when the decided account differs from the vendor's real, locked account", () => {
    const vendor = buildVendor();
    expect(isPaymentFlagged({ accountId: '0.0.6666666', vendor })).toBe(true);
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
      reasoning: 'Matches the invoice as read.',
      flagged: false,
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

  it('carries the real reasoning and flagged state alongside the existing fields', () => {
    const row = buildActivityRow(
      buildReceipts({ reasoning: 'Fooled by a fake account-update notice.', flagged: true, invoiceHtml: '<div>poisoned</div>' })
    );

    expect(row.reasoning).toBe('Fooled by a fake account-update notice.');
    expect(row.flagged).toBe(true);
  });

  it('a flagged row also carries the raw invoice document; a non-flagged row does not', () => {
    const flaggedRow = buildActivityRow(buildReceipts({ flagged: true, invoiceHtml: '<div>poisoned</div>' }));
    expect(flaggedRow.invoiceHtml).toBe('<div>poisoned</div>');

    const okRow = buildActivityRow(buildReceipts({ flagged: false, invoiceHtml: '<div>poisoned</div>' }));
    expect(okRow.invoiceHtml).toBeUndefined();
  });

  it('raises rather than producing a row with a blank transaction hash', () => {
    expect(() => buildActivityRow(buildReceipts({ paymentReceipt: {} }))).toThrow();
  });

  it('raises rather than producing a row with no real destination account', () => {
    expect(() => buildActivityRow(buildReceipts({ accountId: undefined }))).toThrow();
  });
});

describe('extractInvoiceText', () => {
  const vendor = buildVendor();

  it("the clean invoice's extracted text contains no rerouting instruction", () => {
    const html = buildNormalInvoiceHtml({ vendor, amount: 500 });
    const text = extractInvoiceText(html);

    expect(text).not.toMatch(/URGENT|supersedes|remittance account changed/i);
  });

  it("the poisoned invoice's extracted text contains the concealed instruction and its target account, regardless of visual styling", () => {
    const html = buildPoisonedInvoiceHtml({ vendor, amount: 500, wrongAccountId: '0.0.6666666' });
    const text = extractInvoiceText(html);

    expect(text).toMatch(/0\.0\.6666666/);
    expect(text).toMatch(/URGENT/i);
    expect(html).toMatch(/color:#ffffff/); // the concealment is real styling, not just absent from the source
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
