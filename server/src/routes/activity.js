import OpenAI from 'openai';
import { TransferTransaction, TokenId } from '@hiero-ledger/sdk';
import { getPayableAgentClient, getPayableAgentAccountId, getPayableAgentPrivateKey } from '../hedera/client.js';
import { chargeCoverageFee } from '../hedera/coverage-fee.js';
import { logPaymentToHcs } from '../hedera/hcs.js';
import { buildNormalInvoiceHtml, buildPoisonedInvoiceHtml, extractInvoiceText } from '../invoices/invoice-content.js';

// mUSDC (server/scripts/setup-musdc.mjs) has 2 decimals — a whole-dollar amount (e.g. 500)
// converts to its smallest unit by multiplying by 100, same as real USDC cents.
const MUSDC_DECIMALS = 100;
// The coverage fee now settles in the same real mUSDC the vendor payment does (see
// coverage-fee.js's own comment on why) — a small, fixed toll, in smallest mUSDC units:
// "5" = $0.05. Distinct from the vendor payment only in size, never in currency anymore.
const COVERAGE_FEE_SMALLEST_UNITS = process.env.HEDERA_COVERAGE_FEE_AMOUNT || '5';

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

/** A Hedera transaction id (`"0.0.X@seconds.nanos"`) already carries its own real,
 *  consensus-agreed timestamp — using it as this row's `time` ties the displayed time to
 *  the same onchain artifact the Payment Tx column links to, rather than to whenever this
 *  server process happened to finish building the row. Pure. */
export function hederaTxTimestampToIso(transactionId) {
  const [, timestampPart] = transactionId.split('@');
  const [seconds, nanos] = timestampPart.split('.').map(Number);
  return new Date(seconds * 1000 + nanos / 1e6).toISOString();
}

/** Turns real Hedera + HCS receipts (plus PayableAgent's real decision) into the row the
 *  frontend receives. Every row carries the real invoice document PayableAgent actually
 *  read — the clean one and the poisoned one are both real artifacts worth showing, not
 *  just the one that got flagged. Pure. */
export function buildActivityRow({
  vendor,
  accountId,
  amount,
  feeAmountUsd,
  feeReceipt,
  paymentReceipt,
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
    // The vendor payment — the actual invoice amount, in real mUSDC.
    vendorPaymentUsd: amount,
    vendorPaymentTxHash: paymentTxHash,
    // The insurance/coverage toll — a small, fixed amount, also in real mUSDC, but an
    // entirely separate real transaction with its own separate proof.
    insurancePaymentUsd: feeAmountUsd,
    insurancePaymentTxHash: feeTxHash,
    reasoning,
    flagged,
    // The real x402 challenge PayableAgent received and the facilitator's real settlement
    // of it — the protocol payload itself, distinct from the settlement's own onchain
    // proof (insurancePaymentTxHash above already links straight to that transaction).
    x402: feeReceipt?.challenge ? { challenge: feeReceipt.challenge, settlement: { success: feeReceipt.success, network: feeReceipt.network } } : undefined,
    ...(invoiceHtml ? { invoiceHtml } : {}),
    time: hederaTxTimestampToIso(paymentTxHash),
  };
}

/** Maps a raw failure to one of Core Logic's two named error states. Pure. */
export function classifyPaymentError(err, stage) {
  if (stage === 'fee') return 'fee-charge-failed';
  if (stage === 'payment') return 'vendor-payment-failed';
  return 'unknown';
}

async function executeVendorTransfer({ accountId, amount }) {
  const client = getPayableAgentClient();
  const tokenId = TokenId.fromString(process.env.HEDERA_MUSDC_TOKEN_ID);
  const smallestUnits = Math.round(amount * MUSDC_DECIMALS);
  const tx = new TransferTransaction()
    .addTokenTransfer(tokenId, getPayableAgentAccountId(), -smallestUnits)
    .addTokenTransfer(tokenId, accountId, smallestUnits);
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
      amount: COVERAGE_FEE_SMALLEST_UNITS,
      payToAccountId: process.env.HEDERA_RESERVE_POOL_ACCOUNT_ID,
      payerAccountId: getPayableAgentAccountId(),
      payerPrivateKey: getPayableAgentPrivateKey(),
    });
  } catch (err) {
    throw Object.assign(new Error(err.message), { stage: 'fee' });
  }

  let paymentReceipt;
  try {
    paymentReceipt = await executeVendorTransfer({ accountId: decision.accountId, amount: decision.amount });
  } catch (err) {
    throw Object.assign(new Error(err.message), { stage: 'payment' });
  }

  // A real, permanent audit trail tying both transactions together with business context
  // (vendor, kind, amounts) that neither transfer alone carries — kept for real, even
  // though the UI surfaces the transfers themselves as the actual proof.
  await logPaymentToHcs({
    kind,
    vendor: vendor.name,
    accountId: decision.accountId,
    amount: decision.amount,
    feeAmount: COVERAGE_FEE_SMALLEST_UNITS,
    feeTxHash: feeReceipt.transaction,
    paymentTxHash: paymentReceipt.transactionId.toString(),
  });

  return buildActivityRow({
    vendor: vendor.name,
    accountId: decision.accountId,
    amount: decision.amount,
    feeAmountUsd: Number(COVERAGE_FEE_SMALLEST_UNITS) / MUSDC_DECIMALS,
    feeReceipt,
    paymentReceipt,
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
