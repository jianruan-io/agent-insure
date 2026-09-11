import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * InvestigatorAgent's other real evidence source — the vendor's locked, approved account,
 * read straight from the same ENS text record `apps/business/src/lib/ens.ts` writes to and
 * locks. Read-only: a plain public RPC call, no wallet, no signature — the write/lock half
 * of that logic isn't ported here on purpose, since a server-side agent never needs to sign
 * on Northbeam's behalf.
 */

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const AGENT_NAME = process.env.ENS_AGENT_NAME || 'payableagent.agentinsure.eth';
const VENDORS_KEY = 'agentinsure.vendors';
const ZERO_NODE = `0x${'00'.repeat(32)}`;

// Same PermissionedResolver ABI shapes as apps/business/src/lib/ens.ts — verified against
// that same hackathon deployment, not guessed.
const RESOLVER_ABI = [
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
];

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
];

/** Pure DNS wire-format encoding — same implementation as apps/business's ens.ts. */
function dnsEncodeName(name) {
  const labels = name.split('.').filter((label) => label.length > 0);
  const bytes = [];
  for (const label of labels) {
    const labelBytes = new TextEncoder().encode(label);
    bytes.push(labelBytes.length, ...labelBytes);
  }
  bytes.push(0);
  return `0x${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Reads the vendor's real, locked account from the ENS-locked spending rules. Throws if
 *  the vendor isn't in the approved list at all. */
export async function readApprovedAccount({ vendorName }) {
  const resolverAddress = process.env.ENS_AGENT_RESOLVER_ADDRESS;
  if (!resolverAddress) throw new Error('ENS_AGENT_RESOLVER_ADDRESS is not set.');

  const client = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL) });
  const name = dnsEncodeName(AGENT_NAME);
  const innerData = encodeFunctionData({ abi: TEXT_PROFILE_ABI, functionName: 'text', args: [ZERO_NODE, VENDORS_KEY] });

  const resultBytes = await client.readContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: 'resolve',
    args: [name, innerData],
  });
  const vendorsRaw = decodeFunctionResult({ abi: TEXT_PROFILE_ABI, functionName: 'text', data: resultBytes });
  const vendors = vendorsRaw ? JSON.parse(vendorsRaw) : [];

  const match = vendors.find((vendor) => vendor.name === vendorName);
  if (!match) throw new Error(`No ENS-approved account found for vendor "${vendorName}".`);
  return match.account;
}
