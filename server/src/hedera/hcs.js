import { TopicMessageSubmitTransaction } from '@hiero-ledger/sdk';
import { getPayableAgentClient } from './client.js';

/** Submits one JSON message to the payment-log HCS topic, waits for consensus, and
 *  returns the real sequence number — the permanent, independently-checkable record. */
export async function logPaymentToHcs(payload) {
  const topicId = process.env.HEDERA_HCS_TOPIC_ID;
  if (!topicId) throw new Error('HEDERA_HCS_TOPIC_ID is not set — run server/scripts/setup-hedera.mjs first.');

  const client = getPayableAgentClient();
  const message = JSON.stringify(payload);
  if (Buffer.byteLength(message) > 1024) {
    throw new Error('HCS message exceeds the 1024-byte limit — trim the payload before logging.');
  }

  const submitTx = await new TopicMessageSubmitTransaction({ topicId, message }).execute(client);
  const receipt = await submitTx.getReceipt(client);
  return {
    topicSequenceNumber: receipt.topicSequenceNumber.toString(),
    transactionId: submitTx.transactionId.toString(),
  };
}
