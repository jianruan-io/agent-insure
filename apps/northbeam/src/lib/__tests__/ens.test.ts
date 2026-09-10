import { describe, it, expect } from 'vitest';
import {
  deriveLockState,
  buildSpendingRulesCalls,
  classifyLockError,
  dnsEncodeName,
  WalletNotFoundError,
  type VendorRecord,
} from '../ens';

function buildVendors(overrides: VendorRecord[] = [{ name: 'Acme Corp', account: '0x492b…c11a' }]): VendorRecord[] {
  return overrides;
}

describe('deriveLockState', () => {
  it('reports not-written when no records exist yet, write role untouched', () => {
    expect(deriveLockState(false, true)).toBe('not-written');
  });

  it('reports locked when records are written and the write role has been revoked', () => {
    expect(deriveLockState(true, false)).toBe('locked');
  });

  it('reports written-not-locked when records are written but the write role has NOT been revoked', () => {
    expect(deriveLockState(true, true)).toBe('written-not-locked');
  });
});

describe('buildSpendingRulesCalls', () => {
  const name = dnsEncodeName('payableagent.agentinsure.eth');

  it('encodes exactly two calls, one per text record key, for a budget cap and a non-empty vendor list', () => {
    const calls = buildSpendingRulesCalls(name, 5000, buildVendors());

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^0x[0-9a-f]+$/);
    expect(calls[1]).toMatch(/^0x[0-9a-f]+$/);
    expect(calls[0]).not.toBe(calls[1]);
  });

  it('still produces a valid encoded call for an empty vendor list', () => {
    const calls = buildSpendingRulesCalls(name, 5000, []);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/^0x[0-9a-f]+$/);
  });
});

describe('classifyLockError', () => {
  it('classifies no injected wallet found as wallet-not-found', () => {
    expect(classifyLockError(new WalletNotFoundError(), 'connect')).toBe('wallet-not-found');
  });

  it('classifies a rejected connection prompt as connection-rejected', () => {
    expect(classifyLockError({ code: 4001 }, 'connect')).toBe('connection-rejected');
  });

  it('classifies a rejected signature request as signature-rejected', () => {
    expect(classifyLockError({ code: 4001 }, 'write')).toBe('signature-rejected');
  });

  it('classifies a reverted transaction as tx-reverted', () => {
    expect(classifyLockError({ name: 'ContractFunctionRevertedError' }, 'write')).toBe('tx-reverted');
  });

  it('falls back to unknown for an unrecognized error shape, never throws', () => {
    expect(() => classifyLockError('a plain string error', 'write')).not.toThrow();
    expect(classifyLockError('a plain string error', 'write')).toBe('unknown');
  });
});

function toHex(label: string): string {
  return Array.from(new TextEncoder().encode(label))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

describe('dnsEncodeName', () => {
  it('encodes each label with a length prefix and terminates with a zero byte', () => {
    const encoded = dnsEncodeName('payableagent.agentinsure.eth');

    expect(encoded).toBe(
      `0x0c${toHex('payableagent')}0b${toHex('agentinsure')}03${toHex('eth')}00`
    );
  });

  it('is deterministic for the same input', () => {
    expect(dnsEncodeName('payableagent.agentinsure.eth')).toBe(dnsEncodeName('payableagent.agentinsure.eth'));
  });
});
