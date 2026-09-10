import Anthropic from '@anthropic-ai/sdk';
import { TransferTransaction, Hbar } from '@hiero-ledger/sdk';
import { getPayableAgentClient, getPayableAgentAccountId, getPayableAgentPrivateKey } from '../hedera/client.js';
import { chargeCoverageFee } from '../hedera/coverage-fee.js';
import { logPaymentToHcs } from '../hedera/hcs.js';

const COVERAGE_FEE_AMOUNT = process.env.HEDERA_COVERAGE_FEE_AMOUNT || '10000'; // 0.01 test USDC, fixed by design
const VENDOR_PAYMENT_ASSET = '0.0.0'; // vendor invoices are settled in HBAR, not the x402 fee's USDC
const CLAUDE_MODEL = 'claude-sonnet-5';

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

const MAKE_PAYMENT_TOOL = {
  name: 'makePayment',
  description: "Pay a vendor invoice from PayableAgent's Hedera account.",
  input_schema: {
    type: 'object',
    properties: {
      vendorAccountId: { type: 'string', description: 'The Hedera account id to pay (0.0.xxxxx).' },
      amount: { type: 'number', description: 'The amount in whole currency units to pay.' },
    },
    required: ['vendorAccountId', 'amount'],
  },
};

/** PayableAgent's one real Claude call — reads the invoice, decides who gets paid. */
async function decideNormalPayment({ vendor, amount }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    temperature: 0,
    tools: [MAKE_PAYMENT_TOOL],
    messages: [
      {
        role: 'user',
        content:
          `Invoice received from ${vendor.name}, amount $${amount}, requesting payment to Hedera account ` +
          `${vendor.hederaAccountId}. This vendor's account is already on the locked, approved vendor list. ` +
          `Use the makePayment tool to pay this invoice.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use' && block.name === 'makePayment');
  if (!toolUse) throw new Error('PayableAgent did not decide to make a payment.');
  return { vendor: vendor.name, accountId: toolUse.input.vendorAccountId, amount: toolUse.input.amount };
}

async function executeVendorTransfer({ accountId, amount }) {
  const client = getPayableAgentClient();
  const tx = new TransferTransaction()
    .addHbarTransfer(getPayableAgentAccountId(), new Hbar(-amount))
    .addHbarTransfer(accountId, new Hbar(amount));
  const submitted = await tx.execute(client);
  return submitted.getReceipt(client).then((receipt) => ({ ...receipt, transactionId: submitted.transactionId }));
}

/**
 * Orchestrates one real payment: decide (or, for the poisoned path, use the
 * hardcoded wrong target) → charge the coverage fee for real → execute the real
 * vendor transfer → log both to HCS → return the real resulting row.
 */
async function simulatePayment({ kind, vendor, amount, wrongAccountId }) {
  const target =
    kind === 'poisoned'
      ? selectPoisonedPaymentTarget({ vendor, wrongAccountId, amount })
      : await decideNormalPayment({ vendor, amount });

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
    paymentReceipt = await executeVendorTransfer({ accountId: target.accountId, amount: target.amount });
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
