import { TransferTransaction, Hbar } from '@hiero-ledger/sdk';
import { getPayableAgentClient, getPayableAgentAccountId, getPayableAgentPrivateKey } from '../hedera/client.js';
import { chargeCoverageFee } from '../hedera/coverage-fee.js';
import { logPaymentToHcs } from '../hedera/hcs.js';

const COVERAGE_FEE_AMOUNT = process.env.HEDERA_COVERAGE_FEE_AMOUNT || '10000000'; // 0.1 test HBAR, fixed by design
// The invoice's displayed amount (e.g. 500) is a nominal dollar figure, not literally HBAR —
// `new Hbar(500)` would mean 500 real HBAR, which would drain the operator's testnet balance
// in a couple of demo runs. The real on-chain transfer uses this small, fixed test amount
// instead, same as the coverage fee already does — decoupled from the invoice's face value.
const VENDOR_TRANSFER_TINYBARS = process.env.HEDERA_VENDOR_PAYMENT_TINYBARS || '100000000'; // 1 test HBAR

/** The normal path's routing — the one vendor already on the locked, approved list. There's
 *  no real decision to make here (a single pre-approved vendor), so nothing to ask Claude;
 *  a real AI decision only matters once something is trying to fool it (TECH-608). Pure. */
export function selectNormalPaymentTarget({ vendor, amount }) {
  if (!vendor.hederaAccountId) throw new Error('vendor.hederaAccountId is required for the normal path.');
  return { vendor: vendor.name, accountId: vendor.hederaAccountId, amount };
}

/** The poisoned path's hardcoded wrong-account routing — real deception is TECH-608's job. Pure. */
export function selectPoisonedPaymentTarget({ vendor, wrongAccountId, amount }) {
  if (!wrongAccountId) throw new Error('wrongAccountId is required for the poisoned path.');
  return { vendor: vendor.name, accountId: wrongAccountId, amount };
}

/** Turns real Hedera + HCS receipts into the row the frontend receives. Pure. */
export function buildActivityRow({ vendor, accountId, amount, feeAmount, feeReceipt, paymentReceipt, hcsSequenceNumber }) {
  const feeTxHash = feeReceipt?.transaction;
  const paymentTxHash = paymentReceipt?.transactionId?.toString?.() ?? paymentReceipt?.transactionId;
  if (!feeTxHash || !paymentTxHash) {
    throw new Error('Missing a real transaction hash — refusing to build a row the UI would show as paid.');
  }
  if (!accountId) {
    throw new Error('Missing the real destination account — refusing to build a row the UI can\'t show proof for.');
  }
  return {
    vendor,
    account: accountId,
    amount,
    feeAmount,
    feeTxHash,
    paymentTxHash,
    hcsSequenceNumber,
    time: new Date().toISOString(),
  };
}

/** Maps a raw failure to one of Core Logic's two named error states. Pure. */
export function classifyPaymentError(err, stage) {
  if (stage === 'fee') return 'fee-charge-failed';
  if (stage === 'payment') return 'vendor-payment-failed';
  return 'unknown';
}

async function executeVendorTransfer({ accountId }) {
  const client = getPayableAgentClient();
  const tinybars = VENDOR_TRANSFER_TINYBARS;
  const tx = new TransferTransaction()
    .addHbarTransfer(getPayableAgentAccountId(), Hbar.fromTinybars(`-${tinybars}`))
    .addHbarTransfer(accountId, Hbar.fromTinybars(tinybars));
  const submitted = await tx.execute(client);
  return submitted.getReceipt(client).then((receipt) => ({ ...receipt, transactionId: submitted.transactionId }));
}

/**
 * Orchestrates one real payment: pick the target (the vendor's real account, or for the
 * poisoned path, the hardcoded wrong one) → charge the coverage fee for real → execute
 * the real vendor transfer → log both to HCS → return the real resulting row.
 */
async function simulatePayment({ kind, vendor, amount, wrongAccountId }) {
  const target =
    kind === 'poisoned'
      ? selectPoisonedPaymentTarget({ vendor, wrongAccountId, amount })
      : selectNormalPaymentTarget({ vendor, amount });

  let feeReceipt;
  try {
    feeReceipt = await chargeCoverageFee({
      amount: COVERAGE_FEE_AMOUNT,
      payToAccountId: process.env.HEDERA_RESERVE_POOL_ACCOUNT_ID,
      payerAccountId: getPayableAgentAccountId(),
      payerPrivateKey: getPayableAgentPrivateKey(),
    });
  } catch (err) {
    throw Object.assign(new Error(err.message), { stage: 'fee' });
  }

  let paymentReceipt;
  try {
    paymentReceipt = await executeVendorTransfer({ accountId: target.accountId });
  } catch (err) {
    throw Object.assign(new Error(err.message), { stage: 'payment' });
  }

  const hcs = await logPaymentToHcs({
    kind,
    vendor: target.vendor,
    accountId: target.accountId,
    amount: target.amount,
    feeAmount: COVERAGE_FEE_AMOUNT,
    feeTxHash: feeReceipt.transaction,
    paymentTxHash: paymentReceipt.transactionId.toString(),
  });

  return buildActivityRow({
    vendor: target.vendor,
    accountId: target.accountId,
    amount: target.amount,
    feeAmount: COVERAGE_FEE_AMOUNT,
    feeReceipt,
    paymentReceipt,
    hcsSequenceNumber: hcs.topicSequenceNumber,
  });
}

/** Mounts POST /api/activity/simulate. */
export function registerActivityRoutes(app, { getVendor, wrongAccountId }) {
  app.post('/api/activity/simulate', async (req, res) => {
    const kind = req.body?.kind === 'poisoned' ? 'poisoned' : 'normal';
    const vendor = getVendor();
    try {
      const row = await simulatePayment({ kind, vendor, amount: vendor.amount ?? 500, wrongAccountId });
      res.status(200).json(row);
    } catch (err) {
      const stage = classifyPaymentError(err, err.stage);
      res.status(502).json({ error: err.message, stage });
    }
  });
}
