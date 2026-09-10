#!/usr/bin/env node
// One-time setup for TECH-606: registers agentinsure.eth on the hackathon's ENSv2 Sepolia
// deployment (addresses verified against that deployment's own source on Sourcify — never
// the general public ENSv2 beta, per the hackathon's own Discord notice), deploys this
// project's own resolver proxy, and grants the wallet running this script permission to
// write and later lock PayableAgent's spending-rules text records.
//
// Deploying our OWN proxy (rather than pointing agentinsure.eth straight at the shared
// PermissionedResolverImpl address) matters: that implementation's records and roles live
// in ITS OWN storage, shared by anyone who points a name at it directly. A dedicated proxy
// keeps our records and permissions ours alone.
//
// Not part of the live demo — run once, by hand, before using the app's "Lock Rules
// On-Chain" button, from the repo root:
//
//   node apps/northbeam/scripts/register-agentinsure-eth.mjs
//
// Reads its inputs (SEPOLIA_PRIVATE_KEY, the ENS_* contract addresses) from the repo root
// .env.local — same file server/ reads from, per this repo's own convention (see the root
// .env.example). Its output (VITE_ENS_RESOLVER_ADDRESS) goes to a different file, though:
// apps/northbeam/.env.local, since that one's for the frontend and is never read by this
// script or by server/.
//
// Idempotent: re-running after a successful registration reports "already registered,
// skipping" and exits 0 — it never re-registers or re-deploys.

import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData, decodeEventLog } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { normalizePrivateKey } from './normalize-private-key.mjs';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../../.env.local', import.meta.url)));
} catch {
  // No root .env.local yet — the SEPOLIA_PRIVATE_KEY check just below gives a clear
  // message either way, so a missing file here isn't its own separate failure.
}

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = normalizePrivateKey(process.env.SEPOLIA_PRIVATE_KEY);
const LABEL = 'agentinsure';
const NAME = `${LABEL}.eth`;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

// Verified against the hackathon's own deployment (not the general public ENSv2 beta) —
// see specs/.../TECH-606-.../spec.md for how these were confirmed.
const ETH_REGISTRAR_ADDRESS = process.env.ENS_ETH_REGISTRAR_ADDRESS ?? '0x7d1b7f586a62ac3f54b9a396849757814283270b';
const PERMISSIONED_RESOLVER_IMPL =
  process.env.ENS_PERMISSIONED_RESOLVER_IMPL ?? '0xa9d3814ab151bf6e37a427432795371a8361614e';
const VERIFIABLE_FACTORY_ADDRESS =
  process.env.ENS_VERIFIABLE_FACTORY_ADDRESS ?? '0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef';
const MOCK_USDC_ADDRESS = process.env.ENS_MOCK_USDC_ADDRESS ?? '0xcbfd80f74375c54e545af34788ff465f96f66f05';

if (!PRIVATE_KEY) {
  console.error(
    'SEPOLIA_PRIVATE_KEY is not set. Add it to the repo root .env.local (gitignored) — ' +
      'the same wallet later connects live via MetaMask for the demo, but this key only ' +
      'ever runs here, in this one-time setup script.'
  );
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: sepolia, account, transport: http(RPC_URL) });

const REGISTRAR_ABI = parseAbi([
  'function isAvailable(string label) view returns (bool)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256 tokenId)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
]);

const ERC20_ABI = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const FACTORY_ABI = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data) returns (address proxy)',
  'event ProxyDeployed(address indexed sender, address indexed proxy, uint256 salt, address implementation)',
]);

const RESOLVER_INITIALIZE_ABI = parseAbi(['function initialize((address account, uint256 roleBitmap)[] grants, bytes[] calls)']);

// PermissionedResolverLib.sol — nybble 1 authorizes setting text records.
const ROLE_SET_TEXT = 1n << 4n;
const ROLE_SET_TEXT_ADMIN = ROLE_SET_TEXT << 128n;

async function waitFor(hash, label) {
  console.log(`  ${label} — tx ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  console.log(`Using wallet ${account.address} on Sepolia via ${RPC_URL}`);

  const available = await publicClient.readContract({
    address: ETH_REGISTRAR_ADDRESS,
    abi: REGISTRAR_ABI,
    functionName: 'isAvailable',
    args: [LABEL],
  });

  if (!available) {
    console.log(`${NAME} is already registered — skipping.`);
    console.log('If VITE_ENS_RESOLVER_ADDRESS is not yet set in apps/northbeam/.env.local, look up the');
    console.log(`resolver this name currently points to via the ENS Explorer for ${NAME}.`);
    return;
  }

  console.log('Deploying our own resolver proxy via VerifiableFactory (never the shared implementation)...');
  const initData = encodeFunctionData({
    abi: RESOLVER_INITIALIZE_ABI,
    functionName: 'initialize',
    args: [[{ account: account.address, roleBitmap: ROLE_SET_TEXT | ROLE_SET_TEXT_ADMIN }], []],
  });
  const deployHash = await walletClient.writeContract({
    address: VERIFIABLE_FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'deployProxy',
    args: [PERMISSIONED_RESOLVER_IMPL, BigInt(Date.now()), initData],
  });
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });

  let resolverAddress;
  for (const log of deployReceipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === 'ProxyDeployed') {
        resolverAddress = decoded.args.proxy;
        break;
      }
    } catch {
      // a log from a different contract in the same tx — not ours, skip
    }
  }
  if (!resolverAddress) throw new Error('Could not find ProxyDeployed in the deployment receipt logs.');
  console.log(`  resolver proxy deployed at ${resolverAddress} (tx ${deployHash})`);

  const duration = 60n * 60n * 24n * 365n; // 1 year
  const secret = generatePrivateKey(); // a random bytes32 — reused here only as a commit-reveal salt

  const commitment = await publicClient.readContract({
    address: ETH_REGISTRAR_ADDRESS,
    abi: REGISTRAR_ABI,
    functionName: 'makeCommitment',
    args: [LABEL, account.address, secret, ZERO_ADDRESS, resolverAddress, duration, ZERO_BYTES32],
  });

  console.log('Submitting commitment...');
  await waitFor(
    await walletClient.writeContract({ address: ETH_REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: 'commit', args: [commitment] }),
    'commitment recorded'
  );

  const minCommitmentAge = await publicClient.readContract({
    address: ETH_REGISTRAR_ADDRESS,
    abi: REGISTRAR_ABI,
    functionName: 'MIN_COMMITMENT_AGE',
  });
  const waitSeconds = Number(minCommitmentAge) + 5;
  console.log(`Waiting ${waitSeconds}s for the minimum commitment age to pass...`);
  await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));

  const [base, premium] = await publicClient.readContract({
    address: ETH_REGISTRAR_ADDRESS,
    abi: REGISTRAR_ABI,
    functionName: 'getRegisterPrice',
    args: [LABEL, duration, MOCK_USDC_ADDRESS],
  });
  const totalCost = base + premium;

  console.log(`Minting ${totalCost} test USDC (MockUSDC has no access control on this deployment)...`);
  await waitFor(
    await walletClient.writeContract({ address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'mint', args: [account.address, totalCost] }),
    'minted'
  );

  console.log('Approving the registrar to spend it...');
  await waitFor(
    await walletClient.writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ETH_REGISTRAR_ADDRESS, totalCost],
    }),
    'approved'
  );

  console.log(`Registering ${NAME}...`);
  const registerHash = await walletClient.writeContract({
    address: ETH_REGISTRAR_ADDRESS,
    abi: REGISTRAR_ABI,
    functionName: 'register',
    args: [LABEL, account.address, secret, ZERO_ADDRESS, resolverAddress, duration, MOCK_USDC_ADDRESS, ZERO_BYTES32],
  });
  await waitFor(registerHash, 'registered');

  console.log('');
  console.log(`${NAME} registered. tx: ${registerHash}`);
  console.log('');
  console.log('Add this to apps/northbeam/.env.local:');
  console.log(`  VITE_ENS_RESOLVER_ADDRESS=${resolverAddress}`);
  console.log(`  VITE_ENS_AGENT_NAME=payableagent.${NAME}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
