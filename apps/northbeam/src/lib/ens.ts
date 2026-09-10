import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  type Address,
  type Hex,
} from 'viem';
import { sepolia } from 'viem/chains';

/**
 * Talks directly to the resolver proxy `scripts/register-agentinsure-eth.mjs` deploys and
 * initializes once for `payableagent.agentinsure.eth` — never through viem's built-in ENS
 * name-resolution helpers, so the hackathon-vs-production Universal Resolver mismatch that
 * trips up `getEnsText()`-style calls never comes up here at all.
 */

export interface VendorRecord {
  name: string;
  account: string;
}

export type RulesLockState = 'not-written' | 'written-not-locked' | 'locked';

export type LockErrorKind =
  | 'wallet-not-found'
  | 'connection-rejected'
  | 'signature-rejected'
  | 'tx-reverted'
  | 'unknown';

export class WalletNotFoundError extends Error {
  constructor() {
    super('No browser wallet found — install MetaMask (or another injected wallet).');
    this.name = 'WalletNotFoundError';
  }
}

export class LockFlowError extends Error {
  kind: LockErrorKind;

  constructor(kind: LockErrorKind, cause: unknown) {
    super(`Spending-rules on-chain action failed: ${kind}`);
    this.name = 'LockFlowError';
    this.kind = kind;
    this.cause = cause;
  }
}

// ── PermissionedResolver roles (PermissionedResolverLib.sol) — verified against the
// hackathon deployment's source on Sourcify, not guessed from generic docs. ──────────────
const ROLE_SET_TEXT = 1n << 4n;
const ROLE_SET_TEXT_ADMIN = ROLE_SET_TEXT << 128n;
const ROLE_SET_TEXT_FULL = ROLE_SET_TEXT | ROLE_SET_TEXT_ADMIN;
const ROOT_RESOURCE = 0n;

const BUDGET_CAP_KEY = 'agentinsure.budgetCap';
const VENDORS_KEY = 'agentinsure.vendors';

const AGENT_NAME = (import.meta.env.VITE_ENS_AGENT_NAME as string | undefined) ?? 'payableagent.agentinsure.eth';
const SEPOLIA_RPC_URL =
  (import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined) ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'setText',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'bytes' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'multicall',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'calls', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
  {
    type: 'function',
    name: 'resolve',
    stateMutability: 'view',
    inputs: [
      { name: 'name', type: 'bytes' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'hasAssignees',
    stateMutability: 'view',
    inputs: [
      { name: 'resource', type: 'uint256' },
      { name: 'roleBitmap', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'revokeRootRoles',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleBitmap', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

// The `text(bytes32,string)` profile — only ever reached indirectly through the resolver's
// `resolve(name, data)` dispatcher (ENSIP-10), since `payableagent.agentinsure.eth` is a
// non-tokenized wildcard subname, not a name with its own directly-callable resolver entry.
const TEXT_PROFILE_ABI = [
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
] as const;

const ZERO_NODE: Hex = `0x${'00'.repeat(32)}`;

/** Pure DNS wire-format encoding — length-prefixed labels, zero-terminated. No library
 *  dependency, so there's no ambiguity about which encoder's conventions apply. */
export function dnsEncodeName(name: string): Hex {
  const labels = name.split('.').filter((label) => label.length > 0);
  const bytes: number[] = [];
  for (const label of labels) {
    const labelBytes = new TextEncoder().encode(label);
    if (labelBytes.length > 255) throw new Error(`ENS label too long: ${label}`);
    bytes.push(labelBytes.length, ...labelBytes);
  }
  bytes.push(0);
  return `0x${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

/** Turns a raw on-chain readback into the Rules screen's state — pure, no I/O. */
export function deriveLockState(recordsWritten: boolean, writeRoleHeld: boolean): RulesLockState {
  if (!recordsWritten) return 'not-written';
  return writeRoleHeld ? 'written-not-locked' : 'locked';
}

/** Encodes the one multicall transaction that writes both records in a single signature. */
export function buildSpendingRulesCalls(dnsEncodedName: Hex, budgetCap: number, vendors: VendorRecord[]): Hex[] {
  return [
    encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: 'setText',
      args: [dnsEncodedName, BUDGET_CAP_KEY, String(budgetCap)],
    }),
    encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: 'setText',
      args: [dnsEncodedName, VENDORS_KEY, JSON.stringify(vendors)],
    }),
  ];
}

/** Maps a raw wallet/chain error to one of Core Logic's named error states — pure, no I/O. */
export function classifyLockError(err: unknown, stage: 'connect' | 'write'): LockErrorKind {
  if (err instanceof WalletNotFoundError) return 'wallet-not-found';
  const code = (err as { code?: number })?.code ?? (err as { cause?: { code?: number } })?.cause?.code;
  if (code === 4001) return stage === 'connect' ? 'connection-rejected' : 'signature-rejected';
  const name = String((err as { name?: string })?.name ?? (err as { cause?: { name?: string } })?.cause?.name ?? '');
  if (/revert/i.test(name)) return 'tx-reverted';
  return 'unknown';
}

function requireResolverAddress(): Address {
  const address = import.meta.env.VITE_ENS_RESOLVER_ADDRESS as Address | undefined;
  if (!address) {
    throw new Error('VITE_ENS_RESOLVER_ADDRESS is not set — run scripts/register-agentinsure-eth.mjs first.');
  }
  return address;
}

function getPublicClient() {
  return createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL) });
}

async function getWalletClient(): Promise<{ account: Address; client: ReturnType<typeof createWalletClient> }> {
  const injected = (window as unknown as { ethereum?: Parameters<typeof custom>[0] }).ethereum;
  if (!injected) throw new WalletNotFoundError();
  const client = createWalletClient({ chain: sepolia, transport: custom(injected) });
  const [account] = await client.requestAddresses();
  return { account, client };
}

async function readText(resolverAddress: Address, dnsEncodedName: Hex, key: string): Promise<string> {
  const innerData = encodeFunctionData({ abi: TEXT_PROFILE_ABI, functionName: 'text', args: [ZERO_NODE, key] });
  const resultBytes = (await getPublicClient().readContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: 'resolve',
    args: [dnsEncodedName, innerData],
  })) as Hex;
  return decodeFunctionResult({ abi: TEXT_PROFILE_ABI, functionName: 'text', data: resultBytes }) as string;
}

/** Write #1 — connects the browser wallet and, in one signed transaction (resolver
 *  multicall), writes the budget cap and vendor list to `payableagent.agentinsure.eth`. */
export async function writeSpendingRules(budgetCap: number, vendors: VendorRecord[]): Promise<{ txHash: Hex }> {
  let account: Address;
  let client: ReturnType<typeof createWalletClient>;
  try {
    ({ account, client } = await getWalletClient());
  } catch (err) {
    throw new LockFlowError(classifyLockError(err, 'connect'), err);
  }

  const resolverAddress = requireResolverAddress();
  const name = dnsEncodeName(AGENT_NAME);
  const calls = buildSpendingRulesCalls(name, budgetCap, vendors);

  try {
    const txHash = await client.writeContract({
      account,
      chain: sepolia,
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: 'multicall',
      args: [calls],
    });
    await getPublicClient().waitForTransactionReceipt({ hash: txHash });
    return { txHash };
  } catch (err) {
    throw new LockFlowError(classifyLockError(err, 'write'), err);
  }
}

/** Write #2 — a second signed transaction revoking the connected wallet's own write
 *  permission via Enhanced Access Control. Irreversible: once this confirms, nobody can
 *  write to these records again through this resolver. */
export async function lockSpendingRules(): Promise<{ txHash: Hex }> {
  let account: Address;
  let client: ReturnType<typeof createWalletClient>;
  try {
    ({ account, client } = await getWalletClient());
  } catch (err) {
    throw new LockFlowError(classifyLockError(err, 'connect'), err);
  }

  const resolverAddress = requireResolverAddress();

  try {
    const txHash = await client.writeContract({
      account,
      chain: sepolia,
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: 'revokeRootRoles',
      args: [ROLE_SET_TEXT_FULL, account],
    });
    await getPublicClient().waitForTransactionReceipt({ hash: txHash });
    return { txHash };
  } catch (err) {
    throw new LockFlowError(classifyLockError(err, 'write'), err);
  }
}

/** Reads the current text record values and whether write permission has been revoked.
 *  Requires no wallet or signature — safe to call on every page load. */
export async function readSpendingRulesState(): Promise<{
  budgetCap: number | null;
  vendors: VendorRecord[];
  state: RulesLockState;
}> {
  const resolverAddress = requireResolverAddress();
  const name = dnsEncodeName(AGENT_NAME);

  const [budgetCapRaw, vendorsRaw, anyoneCanStillWrite] = await Promise.all([
    readText(resolverAddress, name, BUDGET_CAP_KEY),
    readText(resolverAddress, name, VENDORS_KEY),
    getPublicClient().readContract({
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: 'hasAssignees',
      args: [ROOT_RESOURCE, ROLE_SET_TEXT],
    }) as Promise<boolean>,
  ]);

  const recordsWritten = budgetCapRaw.length > 0;
  return {
    budgetCap: recordsWritten ? Number(budgetCapRaw) : null,
    vendors: vendorsRaw ? (JSON.parse(vendorsRaw) as VendorRecord[]) : [],
    state: deriveLockState(recordsWritten, anyoneCanStillWrite),
  };
}
