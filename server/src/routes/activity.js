import OpenAI from 'openai';
import { TransferTransaction, Hbar } from '@hiero-ledger/sdk';
import { getPayableAgentClient, getPayableAgentAccountId, getPayableAgentPrivateKey } from '../hedera/client.js';
import { chargeCoverageFee } from '../hedera/coverage-fee.js';
import { logPaymentToHcs } from '../hedera/hcs.js';
import { buildNormalInvoiceHtml, buildPoisonedInvoiceHtml, extractInvoiceText } from '../invoices/invoice-content.js';

const COVERAGE_FEE_AMOUNT = process.env.HEDERA_COVERAGE_FEE_AMOUNT || '10000000'; // 0.1 test HBAR, fixed by design
// The invoice's displayed amount (e.g. 500) is a nominal dollar figure, not literally HBAR —
// `new Hbar(500)` would mean 500 real HBAR, which would drain the operator's testnet balance
// in a couple of demo runs. The real on-chain transfer uses this small, fixed test amount
// instead, same as the coverage fee already does — decoupled from the invoice's face value.
const VENDOR_TRANSFER_TINYBARS = process.env.HEDERA_VENDOR_PAYMENT_TINYBARS || '100000000'; // 1 test HBAR

// A local model, no cloud API key — Ollama's OpenAI-compatible server on its default port.
const AI_MODEL = 'llama3.2:3b';
const AI_BASE_URL = 'http://localhost:11434/v1';

const MAKE_PAYMENT_TOOL = {
  type: 'function',
  function: {
    name: 'makePayment',
    description: "Pay a vendor invoice from PayableAgent's Hedera account, based on exactly what the invoice states.",
    parameters: {
      type: 'object',
      properties: {
        vendorAccountId: { type: 'string', description: 'The Hedera account id to pay (0.0.xxxxx), exactly as stated in the invoice.' },
        amount: { type: 'number', description: 'The amount in whole currency units to pay, as stated in the invoice.' },
        reasoning: { type: 'string', description: 'One sentence explaining why this account and amount were chosen.' },
      },
      required: ['vendorAccountId', 'amount', 'reasoning'],
    },
  },
};

/**
 * PayableAgent's one real AI call — reads the invoice's actual extracted text and decides
 * who gets paid via the makePayment tool. No hint about deception is given; whatever the
 * invoice's own text says is what gets acted on, same as for the clean invoice.
 */
export async function decidePaymentFromInvoice({ invoiceText }) {
  // Ollama's OpenAI-compatible server doesn't check the key — the SDK just requires a
  // non-empty string to construct the client.
  const client = new OpenAI({ apiKey: 'ollama', baseURL: AI_BASE_URL });

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    temperature: 0,
    seed: 42,
    tools: [MAKE_PAYMENT_TOOL],
    tool_choice: { type: 'function', function: { name: 'makePayment' } },
    messages: [
      {
        role: 'user',
        content: `Here is the invoice PayableAgent received:\n\n${invoiceText}\n\nDecide who to pay using the makePayment tool.`,
      },
    ],
  });

  const toolCall = response.choices?.[0]?.message?.tool_calls?.find((call) => call.function?.name === 'makePayment');
  if (!toolCall) throw new Error('PayableAgent did not decide to make a payment.');

  const args = JSON.parse(toolCall.function.arguments);
  // A local model doesn't always respect the schema's declared type (observed: "500" for
  // a number field) — coerce rather than trust it verbatim.
  return { accountId: args.vendorAccountId, amount: Number(args.amount), reasoning: args.reasoning };
}

/** A row is flagged only when the decided account doesn't match the vendor's real, locked
 *  account — never a value chosen by which invoice/button was used. Pure. */
export function isPaymentFlagged({ accountId, vendor }) {
  return accountId !== vendor.hederaAccountId;
}

/** Turns real Hedera + HCS receipts (plus PayableAgent's real decision) into the row the
 *  frontend receives. A flagged row also carries the raw invoice document to display; a
 *  non-flagged row doesn't. Pure. */
export function buildActivityRow({
  vendor,
  accountId,
  amount,
  feeAmount,
  feeReceipt,
  paymentReceipt,
  hcsSequenceNumber,
  reasoning,
  flagged,
  invoiceHtml,
}) {
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
    reasoning,
    flagged,
    ...(flagged && invoiceHtml ? { invoiceHtml } : {}),
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
 * Orchestrates one real payment: build the real invoice (clean or poisoned) → PayableAgent's
 * real AI call reads it and decides who gets paid → charge the coverage fee for real →
 * execute the real vendor transfer → log both to HCS → return the real resulting row.
 */
async function simulatePayment({ kind, vendor, amount, wrongAccountId }) {
  const invoiceHtml =
    kind === 'poisoned'
      ? buildPoisonedInvoiceHtml({ vendor, amount, wrongAccountId })
      : buildNormalInvoiceHtml({ vendor, amount });
  const invoiceText = extractInvoiceText(invoiceHtml);

  const decision = await decidePaymentFromInvoice({ invoiceText });
  const flagged = isPaymentFlagged({ accountId: decision.accountId, vendor });

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
    paymentReceipt = await executeVendorTransfer({ accountId: decision.accountId });
  } catch (err) {
    throw Object.assign(new Error(err.message), { stage: 'payment' });
  }

  const hcs = await logPaymentToHcs({
    kind,
    vendor: vendor.name,
    accountId: decision.accountId,
    amount: decision.amount,
    feeAmount: COVERAGE_FEE_AMOUNT,
    feeTxHash: feeReceipt.transaction,
    paymentTxHash: paymentReceipt.transactionId.toString(),
  });

  return buildActivityRow({
    vendor: vendor.name,
    accountId: decision.accountId,
    amount: decision.amount,
    feeAmount: COVERAGE_FEE_AMOUNT,
    feeReceipt,
    paymentReceipt,
    hcsSequenceNumber: hcs.topicSequenceNumber,
    reasoning: decision.reasoning,
    flagged,
    invoiceHtml,
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
