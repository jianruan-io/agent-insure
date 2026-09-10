import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import { createClientHederaSigner, HEDERA_TESTNET_USDC } from '@x402/hedera';

/**
 * The x402 coverage fee — charged automatically before any vendor payment can
 * execute, per this issue's own business rule: never something PayableAgent
 * "decides" to pay, always enforced by the endpoint itself refusing to proceed
 * without it (HTTP 402). Verified against @x402/core and @x402/hedera's own
 * shipped type declarations, not guessed — see this issue's spec for how.
 */

const DEFAULT_ASSET = HEDERA_TESTNET_USDC; // '0.0.429274'
const DEFAULT_FACILITATOR_URL = 'https://api.testnet.blocky402.com';
const X402_VERSION = 1;
const RESOURCE_URL = '/api/coverage/charge';

/** Builds one real PaymentRequirements row. Pure. */
export function buildCoverageFeeRequirements({ amount, payToAccountId, asset = DEFAULT_ASSET }) {
  if (!amount || Number(amount) <= 0) {
    throw new Error('Coverage fee amount must be a positive value — refusing to charge nothing.');
  }
  if (!payToAccountId) throw new Error('payToAccountId is required');
  if (!asset) throw new Error('asset is required');
  return {
    scheme: 'exact',
    network: 'hedera:testnet',
    asset,
    payTo: payToAccountId,
    amount: String(amount),
    maxTimeoutSeconds: 60,
    extra: {},
  };
}

/** The full HTTP 402 body — wraps the requirements the way the protocol expects. Pure. */
function buildPaymentRequiredBody(requirements) {
  return {
    x402Version: X402_VERSION,
    error: 'Coverage fee required before this payment can proceed.',
    resource: { url: RESOURCE_URL, description: 'PayableAgent coverage fee', serviceName: 'agent-insure' },
    accepts: [requirements],
  };
}

/** Detects whether a request already carries an (unverified) payment proof. Pure. */
export function hasValidPaymentHeader(req) {
  const header = req.headers?.['x-payment'];
  if (!header || typeof header !== 'string') return false;
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    return typeof decoded === 'object' && decoded !== null && 'x402Version' in decoded;
  } catch {
    return false;
  }
}

function getFacilitator() {
  return new HTTPFacilitatorClient({ url: process.env.BLOCKY402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL });
}

/**
 * Mounts the real, externally-callable x402-gated charge endpoint. A bare call
 * (no X-PAYMENT) returns the 402 challenge; a call with a valid payment proof
 * verifies and settles it for real through Blocky402, returning the receipt.
 */
export function registerCoverageFeeRoute(app, { getRequirements }) {
  app.post('/api/coverage/charge', async (req, res) => {
    let requirements;
    try {
      requirements = getRequirements();
    } catch (err) {
      // A config problem (e.g. HEDERA_RESERVE_POOL_ACCOUNT_ID not set yet) is a real
      // 500, not a payment problem — and must never take the whole process down.
      return res.status(500).json({ error: err.message });
    }
    if (!hasValidPaymentHeader(req)) {
      return res.status(402).json(buildPaymentRequiredBody(requirements));
    }
    try {
      const receipt = await settleCoverageFee(req.headers['x-payment'], requirements);
      return res.status(200).json(receipt);
    } catch (err) {
      return res.status(402).json({ ...buildPaymentRequiredBody(requirements), error: err.message });
    }
  });
}

/** Verifies then settles a payment proof against the real Blocky402 facilitator. */
async function settleCoverageFee(paymentHeaderBase64, requirements) {
  const facilitator = getFacilitator();
  const payloadResult = JSON.parse(Buffer.from(paymentHeaderBase64, 'base64').toString('utf8'));
  const paymentPayload = { x402Version: X402_VERSION, accepted: requirements, payload: payloadResult.payload };

  const verifyResult = await facilitator.verify(paymentPayload, requirements);
  if (!verifyResult.isValid) {
    throw new Error(verifyResult.invalidReason ?? 'Coverage fee payment did not verify');
  }
  const settleResult = await facilitator.settle(paymentPayload, requirements);
  if (!settleResult.success) {
    throw new Error(settleResult.errorReason ?? 'Coverage fee payment did not settle');
  }
  return settleResult;
}

/**
 * PayableAgent's own side of the exchange — since this is an autonomous agent
 * flow with no human clicking through a wallet, the same process plays both the
 * resource server's role (above) and, here, the paying client's role: build a
 * real signed Hedera transfer for the requirements, then verify+settle it.
 */
export async function chargeCoverageFee({ amount, payToAccountId, asset, payerAccountId, payerPrivateKey }) {
  const requirements = buildCoverageFeeRequirements({ amount, payToAccountId, asset });
  const signer = createClientHederaSigner(payerAccountId, payerPrivateKey);
  const scheme = new ExactHederaScheme(signer);
  const payloadResult = await scheme.createPaymentPayload(X402_VERSION, requirements);
  const paymentHeaderBase64 = Buffer.from(JSON.stringify(payloadResult)).toString('base64');
  return settleCoverageFee(paymentHeaderBase64, requirements);
}
