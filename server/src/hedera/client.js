import { Client, PrivateKey } from '@hiero-ledger/sdk';

/**
 * `PrivateKey.fromString()` can't reliably tell ECDSA from ED25519 apart for a plain
 * hex-encoded key (both are 32-byte raw hex with no type prefix) — it guessed wrong for
 * this project's operator key, causing a real INVALID_SIGNATURE precheck failure. This
 * account's real key type was confirmed via the public testnet mirror node
 * (GET /api/v1/accounts/{id} → key._type: "ECDSA_SECP256K1"), not guessed.
 */
function parseOperatorPrivateKey(key) {
  return PrivateKey.fromStringECDSA(key);
}

/** PayableAgent's own Hedera testnet client — the account that pays both the coverage fee and the vendor. */
export function getPayableAgentClient() {
  const accountId = process.env.HEDERA_OPERATOR_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
  if (!accountId || !privateKey) {
    throw new Error('HEDERA_OPERATOR_ACCOUNT_ID / HEDERA_OPERATOR_PRIVATE_KEY are not set in the root .env.local.');
  }
  const client = Client.forTestnet();
  client.setOperator(accountId, parseOperatorPrivateKey(privateKey));
  return client;
}

export function getPayableAgentAccountId() {
  const accountId = process.env.HEDERA_OPERATOR_ACCOUNT_ID;
  if (!accountId) throw new Error('HEDERA_OPERATOR_ACCOUNT_ID is not set.');
  return accountId;
}

export function getPayableAgentPrivateKey() {
  const key = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
  if (!key) throw new Error('HEDERA_OPERATOR_PRIVATE_KEY is not set.');
  return parseOperatorPrivateKey(key);
}
