#!/usr/bin/env node
// One-time setup for TECH-607: creates the two Hedera accounts this feature needs
// beyond PayableAgent's own (already-provisioned HEDERA_OPERATOR_ACCOUNT_ID) — the
// reserve pool that receives the x402 coverage fee, and the vendor that receives
// real vendor payments — and creates the HCS topic both payments get logged to.
//
// Not part of the live demo — run once, by hand, from the repo root:
//
//   node server/scripts/setup-hedera.mjs
//
// Reads HEDERA_OPERATOR_ACCOUNT_ID/HEDERA_OPERATOR_PRIVATE_KEY from the repo root
// .env.local (same file server/ itself reads from) to pay for account/topic creation.
//
// Idempotent: if HEDERA_RESERVE_POOL_ACCOUNT_ID, HEDERA_VENDOR_ACCOUNT_ID, and
// HEDERA_HCS_TOPIC_ID are already set in .env.local, reports that and exits 0
// without creating anything new.

import { fileURLToPath } from 'node:url';
import {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
  TopicCreateTransaction,
} from '@hiero-ledger/sdk';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env.local', import.meta.url)));
} catch {
  // No root .env.local yet — the checks below give a clear message either way.
}

const OPERATOR_ACCOUNT_ID = process.env.HEDERA_OPERATOR_ACCOUNT_ID;
const OPERATOR_PRIVATE_KEY = process.env.HEDERA_OPERATOR_PRIVATE_KEY;

if (!OPERATOR_ACCOUNT_ID || !OPERATOR_PRIVATE_KEY) {
  console.error(
    'HEDERA_OPERATOR_ACCOUNT_ID / HEDERA_OPERATOR_PRIVATE_KEY are not set in the repo root .env.local. ' +
      'These should already be provisioned (see .env.example) — add them first.'
  );
  process.exit(1);
}

if (process.env.HEDERA_RESERVE_POOL_ACCOUNT_ID && process.env.HEDERA_VENDOR_ACCOUNT_ID && process.env.HEDERA_HCS_TOPIC_ID) {
  console.log('Already set up — HEDERA_RESERVE_POOL_ACCOUNT_ID, HEDERA_VENDOR_ACCOUNT_ID, and HEDERA_HCS_TOPIC_ID are all set. Skipping.');
  process.exit(0);
}

const client = Client.forTestnet();
client.setOperator(OPERATOR_ACCOUNT_ID, PrivateKey.fromString(OPERATOR_PRIVATE_KEY));

async function createAccount(memo) {
  const newKey = PrivateKey.generateECDSA();
  const tx = new AccountCreateTransaction()
    .setKeyWithoutAlias(newKey.publicKey)
    .setInitialBalance(new Hbar(5))
    .setMaxAutomaticTokenAssociations(-1) // so it can receive the USDC coverage fee with no separate association step
    .setAccountMemo(memo);
  const submitted = await tx.execute(client);
  const receipt = await submitted.getReceipt(client);
  return { accountId: receipt.accountId.toString(), privateKey: newKey.toStringRaw() };
}

async function main() {
  console.log(`Using operator ${OPERATOR_ACCOUNT_ID} on Hedera testnet`);

  console.log('Creating the reserve pool account (Agent Insure)...');
  const reservePool = await createAccount('Agent Insure reserve pool');
  console.log(`  ${reservePool.accountId}`);

  console.log('Creating the vendor account (Acme Corp)...');
  const vendor = await createAccount('Acme Corp — demo vendor');
  console.log(`  ${vendor.accountId}`);

  console.log('Creating the HCS payment-log topic...');
  const topicTx = await new TopicCreateTransaction().setTopicMemo('agent-insure payment log').execute(client);
  const topicReceipt = await topicTx.getReceipt(client);
  console.log(`  ${topicReceipt.topicId.toString()}`);

  console.log('');
  console.log('Add these to the repo root .env.local:');
  console.log(`  HEDERA_RESERVE_POOL_ACCOUNT_ID=${reservePool.accountId}`);
  console.log(`  HEDERA_RESERVE_POOL_PRIVATE_KEY=${reservePool.privateKey}`);
  console.log(`  HEDERA_VENDOR_ACCOUNT_ID=${vendor.accountId}`);
  console.log(`  HEDERA_HCS_TOPIC_ID=${topicReceipt.topicId.toString()}`);
  console.log('');
  console.log(
    '(The vendor account\'s private key is intentionally not printed — nothing in this ' +
      'flow ever signs as the vendor, only pays it.)'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
