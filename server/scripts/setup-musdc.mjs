#!/usr/bin/env node
// One-time setup for TECH-663: creates a real, dollar-pegged mock USDC token (mUSDC) —
// real HBAR's testnet USDC treasury has no public faucet, so PayableAgent's operator
// account can never hold any of it (already hit building TECH-607). Treasury is
// PayableAgent's own operator account, and a real starting mUSDC balance is transferred
// to the reserve pool so it can actually pay claims out.
//
// Not part of the live demo — run once, by hand, from the repo root:
//
//   node server/scripts/setup-musdc.mjs
//
// Reads HEDERA_OPERATOR_ACCOUNT_ID/HEDERA_OPERATOR_PRIVATE_KEY and
// HEDERA_RESERVE_POOL_ACCOUNT_ID from the repo root .env.local — run
// setup-hedera.mjs first if those aren't set yet.
//
// Idempotent: if HEDERA_MUSDC_TOKEN_ID is already set in .env.local, reports that and
// exits 0 without creating anything new.

import { fileURLToPath } from 'node:url';
import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TransferTransaction,
} from '@hiero-ledger/sdk';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env.local', import.meta.url)));
} catch {
  // No root .env.local yet — the checks below give a clear message either way.
}

const OPERATOR_ACCOUNT_ID = process.env.HEDERA_OPERATOR_ACCOUNT_ID;
const OPERATOR_PRIVATE_KEY = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
const RESERVE_POOL_ACCOUNT_ID = process.env.HEDERA_RESERVE_POOL_ACCOUNT_ID;

if (!OPERATOR_ACCOUNT_ID || !OPERATOR_PRIVATE_KEY || !RESERVE_POOL_ACCOUNT_ID) {
  console.error(
    'HEDERA_OPERATOR_ACCOUNT_ID / HEDERA_OPERATOR_PRIVATE_KEY / HEDERA_RESERVE_POOL_ACCOUNT_ID ' +
      'are not all set in the repo root .env.local. Run server/scripts/setup-hedera.mjs first.'
  );
  process.exit(1);
}

if (process.env.HEDERA_MUSDC_TOKEN_ID) {
  console.log(`Already set up — HEDERA_MUSDC_TOKEN_ID=${process.env.HEDERA_MUSDC_TOKEN_ID} is already set. Skipping.`);
  process.exit(0);
}

const client = Client.forTestnet();
// Same real key type as the operator account's own — confirmed ECDSA_SECP256K1 via
// the public mirror node when it was first provisioned, not guessed.
const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_PRIVATE_KEY);
client.setOperator(OPERATOR_ACCOUNT_ID, operatorKey);

// 2 decimals, same as real USDC's cent-level precision — $1.00 = 100 smallest units.
const DECIMALS = 2;
const INITIAL_SUPPLY = 10_000_000_00; // 10,000,000.00 mUSDC total
const RESERVE_POOL_ALLOCATION = 100_000_00; // 100,000.00 mUSDC — real capacity to pay real claims

async function main() {
  console.log(`Using operator ${OPERATOR_ACCOUNT_ID} on Hedera testnet`);

  console.log('Creating the mUSDC token (treasury = PayableAgent\'s operator account)...');
  const createTx = await new TokenCreateTransaction()
    .setTokenName('Mock USDC')
    .setTokenSymbol('mUSDC')
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(DECIMALS)
    .setInitialSupply(INITIAL_SUPPLY)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(OPERATOR_ACCOUNT_ID)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .freezeWith(client)
    .sign(operatorKey);
  const createSubmit = await createTx.execute(client);
  const createReceipt = await createSubmit.getReceipt(client);
  const tokenId = createReceipt.tokenId.toString();
  console.log(`  ${tokenId}`);

  console.log(`Funding the reserve pool (${RESERVE_POOL_ACCOUNT_ID}) with real mUSDC to pay claims from...`);
  const fundTx = await new TransferTransaction()
    .addTokenTransfer(tokenId, OPERATOR_ACCOUNT_ID, -RESERVE_POOL_ALLOCATION)
    .addTokenTransfer(tokenId, RESERVE_POOL_ACCOUNT_ID, RESERVE_POOL_ALLOCATION)
    .execute(client);
  await fundTx.getReceipt(client);
  console.log(`  transferred ${(RESERVE_POOL_ALLOCATION / 100).toFixed(2)} mUSDC`);

  console.log('');
  console.log('Add this to the repo root .env.local:');
  console.log(`  HEDERA_MUSDC_TOKEN_ID=${tokenId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
