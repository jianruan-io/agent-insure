import { Client, PrivateKey } from '@hiero-ledger/sdk';

/** PayableAgent's own Hedera testnet client — the account that pays both the coverage fee and the vendor. */
export function getPayableAgentClient() {
  const accountId = process.env.HEDERA_OPERATOR_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
  if (!accountId || !privateKey) {
    throw new Error('HEDERA_OPERATOR_ACCOUNT_ID / HEDERA_OPERATOR_PRIVATE_KEY are not set in the root .env.local.');
  }
  const client = Client.forTestnet();
  client.setOperator(accountId, PrivateKey.fromString(privateKey));
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
  return PrivateKey.fromString(key);
}
