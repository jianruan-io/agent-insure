const MIRROR_NODE_BASE_URL = process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com';

/** Decodes one real HCS topic message back into the payment record PayableAgent logged
 *  (`server/src/hedera/hcs.js`'s `logPaymentToHcs` payload). Pure. */
export function decodeTopicMessage(base64Message) {
  return JSON.parse(Buffer.from(base64Message, 'base64').toString('utf8'));
}

/**
 * InvestigatorAgent's evidence — pulls every payment PayableAgent has ever logged for this
 * vendor from the real HCS payment-log topic, via Hedera Mirror Node's public REST API.
 */
export async function fetchVendorPaymentHistory({ vendor }) {
  const topicId = process.env.HEDERA_HCS_TOPIC_ID;
  if (!topicId) throw new Error('HEDERA_HCS_TOPIC_ID is not set — run server/scripts/setup-hedera.mjs first.');

  const response = await fetch(`${MIRROR_NODE_BASE_URL}/api/v1/topics/${topicId}/messages`);
  if (!response.ok) {
    throw new Error(`Hedera Mirror Node request failed: ${response.status}`);
  }
  const body = await response.json();

  return (body.messages ?? []).map((entry) => decodeTopicMessage(entry.message)).filter((record) => record.vendor === vendor);
}

/**
 * PayoutAgent's real funds check — the reserve pool's own live HBAR balance, read straight
 * from Hedera Mirror Node, never a client-side or cached number.
 */
export async function fetchAccountBalance(accountId) {
  const response = await fetch(`${MIRROR_NODE_BASE_URL}/api/v1/accounts/${accountId}`);
  if (!response.ok) {
    throw new Error(`Hedera Mirror Node request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.balance.balance;
}

/**
 * PayoutAgent's real funds check for the mUSDC rail — the reserve pool's own live token
 * balance, read straight from Hedera Mirror Node, never a client-side or cached number.
 */
export async function fetchTokenBalance(accountId, tokenId) {
  const response = await fetch(`${MIRROR_NODE_BASE_URL}/api/v1/accounts/${accountId}`);
  if (!response.ok) {
    throw new Error(`Hedera Mirror Node request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.balance.tokens.find((entry) => entry.token_id === tokenId)?.balance ?? 0;
}
