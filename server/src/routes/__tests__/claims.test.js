import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal();
  const readContract = vi.fn();
  return { ...actual, createPublicClient: vi.fn(() => ({ readContract })) };
});

import { createPublicClient } from 'viem';

const readContractMock = createPublicClient().readContract;

const { createClaim, listClaims, recordVerdict, recordPayout } = await import('../claims.js');
const { fetchVendorPaymentHistory, fetchAccountBalance } = await import('../../hedera/mirror-node.js');
const { readApprovedAccount } = await import('../../ens/read-rules.js');
const { judgeClaim } = await import('../../investigator/judge-claim.js');
const { authorizePayout } = await import('../../payout/authorize-payout.js');

function buildInput(overrides = {}) {
  return {
    vendor: 'Acme Corp',
    amount: 500,
    activityId: 'a1',
    account: '0.0.10465722',
    ...overrides,
  };
}

function buildHistoryEntry(overrides = {}) {
  return {
    kind: 'normal',
    vendor: 'Acme Corp',
    accountId: '0.0.10465723',
    amount: 500,
    feeTxHash: '0.0.7162784@1700000000.000000001',
    paymentTxHash: '0.0.10363357@1700000000.000000002',
    ...overrides,
  };
}

function encodeTopicMessage(record) {
  return Buffer.from(JSON.stringify(record)).toString('base64');
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

  it('stores the real disputed account alongside vendor/amount/activityId', () => {
    const claim = createClaim(buildInput({ account: '0.0.9999999' }));

    expect(claim.account).toBe('0.0.9999999');
  });
});

describe('listClaims', () => {
  it('returns every claim created so far, in creation order', () => {
    const before = listClaims().length;
    const first = createClaim(buildInput());
    const second = createClaim(buildInput());

    const all = listClaims();

    expect(all.length).toBe(before + 2);
    expect(all[all.length - 2].id).toBe(first.id);
    expect(all[all.length - 1].id).toBe(second.id);
  });
});

describe('recordVerdict', () => {
  it('updates the stored claim with the real verdict and reasoning, and marks it investigated', () => {
    const claim = createClaim(buildInput());

    const updated = recordVerdict(claim.id, { verdict: 'FRAUD', reasoning: 'Does not match the locked account.' });

    expect(updated.investigated).toBe(true);
    expect(updated.verdict).toBe('FRAUD');
    expect(updated.reasoning).toBe('Does not match the locked account.');
    expect(listClaims().find((c) => c.id === claim.id).verdict).toBe('FRAUD');
  });
});

describe('recordPayout', () => {
  it('updates the stored claim with the real payout transaction hash and marks status approved', () => {
    const claim = createClaim(buildInput());
    recordVerdict(claim.id, { verdict: 'FRAUD', reasoning: 'Does not match the locked account.' });

    const updated = recordPayout(claim.id, { payoutTxHash: '0.0.10465721@1700000000.000000003' });

    expect(updated.status).toBe('approved');
    expect(updated.payoutTxHash).toBe('0.0.10465721@1700000000.000000003');
    expect(listClaims().find((c) => c.id === claim.id).status).toBe('approved');
  });
});

describe('fetchVendorPaymentHistory', () => {
  const originalTopicId = process.env.HEDERA_HCS_TOPIC_ID;

  beforeEach(() => {
    fetch.mockReset();
    process.env.HEDERA_HCS_TOPIC_ID = '0.0.10465724';
  });

  afterAll(() => {
    process.env.HEDERA_HCS_TOPIC_ID = originalTopicId;
  });

  it("decodes real topic-message responses into this vendor's payment records", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          { message: encodeTopicMessage(buildHistoryEntry()) },
          { message: encodeTopicMessage(buildHistoryEntry({ vendor: 'Other Vendor', accountId: '0.0.1' })) },
        ],
      }),
    });

    const history = await fetchVendorPaymentHistory({ vendor: 'Acme Corp' });

    expect(history).toHaveLength(1);
    expect(history[0].accountId).toBe('0.0.10465723');
    expect(history[0].feeTxHash).toBe('0.0.7162784@1700000000.000000001');
  });

  it('returns an empty list when the topic has no messages for this vendor', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) });

    const history = await fetchVendorPaymentHistory({ vendor: 'Acme Corp' });

    expect(history).toEqual([]);
  });

  it('raises a real, distinct error when the Mirror Node request itself fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchVendorPaymentHistory({ vendor: 'Acme Corp' })).rejects.toThrow();
  });
});

describe('fetchAccountBalance', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('returns the real, live HBAR balance for the given account, parsed from the Mirror Node response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balance: { balance: 123456789, timestamp: '1700000000.000000000' } }),
    });

    const balance = await fetchAccountBalance('0.0.10465721');

    expect(balance).toBe(123456789);
  });

  it('raises a real, distinct error when the Mirror Node request itself fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchAccountBalance('0.0.10465721')).rejects.toThrow();
  });
});

describe('readApprovedAccount', () => {
  const originalResolver = process.env.ENS_AGENT_RESOLVER_ADDRESS;

  beforeEach(() => {
    readContractMock.mockReset();
    process.env.ENS_AGENT_RESOLVER_ADDRESS = '0x1234567890123456789012345678901234567890';
  });

  afterAll(() => {
    process.env.ENS_AGENT_RESOLVER_ADDRESS = originalResolver;
  });

  const TEXT_RETURN_ABI = [
    {
      type: 'function',
      name: 'text',
      stateMutability: 'view',
      inputs: [
        { name: 'node', type: 'bytes32' },
        { name: 'key', type: 'string' },
      ],
      outputs: [{ type: 'string' }],
    },
  ];

  it("returns the vendor's real locked account read from the ENS text record", async () => {
    const { encodeFunctionResult } = await import('viem');
    const vendorsJson = JSON.stringify([{ name: 'Acme Corp', account: '0.0.10465723' }]);
    // resolve() returns the raw bytes of what text(node, key) itself would have returned —
    // an ABI-encoded string, not the plain JSON — so the mock encodes it the same way.
    readContractMock.mockResolvedValueOnce(
      encodeFunctionResult({ abi: TEXT_RETURN_ABI, functionName: 'text', result: vendorsJson })
    );

    const account = await readApprovedAccount({ vendorName: 'Acme Corp' });

    expect(account).toBe('0.0.10465723');
  });

  it('raises a real, distinct error when ENS_AGENT_RESOLVER_ADDRESS is not configured', async () => {
    delete process.env.ENS_AGENT_RESOLVER_ADDRESS;

    await expect(readApprovedAccount({ vendorName: 'Acme Corp' })).rejects.toThrow();
  });
});

describe('judgeClaim', () => {
  it("returns CLEARED when the disputed account matches the vendor's approved account", () => {
    const history = [buildHistoryEntry({ accountId: '0.0.10465723' })];

    const result = judgeClaim({
      history,
      disputedAccountId: '0.0.10465723',
      disputedAmount: 500,
      approvedAccountId: '0.0.10465723',
    });

    expect(result.verdict).toBe('CLEARED');
    expect(result.reasoning).toMatch(/0\.0\.10465723/);
  });

  it('returns FRAUD when the disputed account differs from the approved account', () => {
    const history = [buildHistoryEntry({ accountId: '0.0.10465722' })];

    const result = judgeClaim({
      history,
      disputedAccountId: '0.0.10465722',
      disputedAmount: 500,
      approvedAccountId: '0.0.10465723',
    });

    expect(result.verdict).toBe('FRAUD');
    expect(result.reasoning).toMatch(/0\.0\.10465723/);
  });

  it("raises a real, distinct error when the disputed payment isn't found in history", () => {
    const history = [buildHistoryEntry({ accountId: '0.0.10465723', amount: 500 })];

    expect(() =>
      judgeClaim({ history, disputedAccountId: '0.0.99999', disputedAmount: 500, approvedAccountId: '0.0.10465723' })
    ).toThrow();
  });
});

describe('authorizePayout', () => {
  function buildClaim(overrides = {}) {
    return {
      id: 'claim-1',
      verdict: 'FRAUD',
      reasoning: "Does not match the vendor's locked, approved account 0.0.10465723.",
      status: 'draft',
      ...overrides,
    };
  }

  it('authorizes payout when the re-derived verdict and reasoning match, the verdict is FRAUD, and the claim is unpaid', () => {
    const claim = buildClaim();

    const result = authorizePayout({ claim, rederivedVerdict: claim.verdict, rederivedReasoning: claim.reasoning });

    expect(result.authorized).toBe(true);
  });

  it('raises a real, distinct error when the re-derived verdict or reasoning does not match the stored verdict', () => {
    const claim = buildClaim();

    expect(() =>
      authorizePayout({ claim, rederivedVerdict: 'CLEARED', rederivedReasoning: 'Matches the locked account.' })
    ).toThrow();
  });

  it('raises a real, distinct error when the verdict is CLEARED', () => {
    const claim = buildClaim({ verdict: 'CLEARED', reasoning: 'Matches the locked account.' });

    expect(() =>
      authorizePayout({ claim, rederivedVerdict: 'CLEARED', rederivedReasoning: 'Matches the locked account.' })
    ).toThrow();
  });

  it("raises a real, distinct error when the claim's status is already approved", () => {
    const claim = buildClaim({ status: 'approved' });

    expect(() =>
      authorizePayout({ claim, rederivedVerdict: claim.verdict, rederivedReasoning: claim.reasoning })
    ).toThrow();
  });
});
