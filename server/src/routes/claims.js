import { TransferTransaction, TokenId } from '@hiero-ledger/sdk';
import { fetchVendorPaymentHistory, fetchTokenBalance } from '../hedera/mirror-node.js';
import { readApprovedAccount } from '../ens/read-rules.js';
import { judgeClaim } from '../investigator/judge-claim.js';
import { authorizePayout } from '../payout/authorize-payout.js';
import { getReservePoolClient, getReservePoolAccountId, getPayableAgentAccountId } from '../hedera/client.js';
import { logPaymentToHcs } from '../hedera/hcs.js';

// mUSDC (server/scripts/setup-musdc.mjs) has 2 decimals — a claim's whole-dollar amount
// converts to its smallest unit by multiplying by 100, same as real USDC cents.
const MUSDC_DECIMALS = 100;

const claims = [];
let nextClaimId = 1;

/** Creates and stores one real claim record — the shared anchor the identity check, the
 *  investigator, and the eventual payout will all reference. */
export function createClaim({ vendor, amount, activityId, account }) {
  const claim = {
    id: `claim-${nextClaimId}`,
    vendor,
    amount,
    activityId,
    account,
    status: 'draft',
    investigated: false,
    verdict: null,
    reasoning: null,
    payoutTxHash: null,
    createdAt: new Date().toISOString(),
  };
  nextClaimId += 1;
  claims.push(claim);
  return claim;
}

/** Every claim ever filed, in creation order. */
export function listClaims() {
  return claims;
}

function findClaim(id) {
  return claims.find((claim) => claim.id === id);
}

/** Records InvestigatorAgent's real verdict + reasoning on the claim. */
export function recordVerdict(id, { verdict, reasoning }) {
  const claim = findClaim(id);
  if (!claim) throw new Error(`Claim ${id} not found.`);
  claim.investigated = true;
  claim.verdict = verdict;
  claim.reasoning = reasoning;
  return claim;
}

/** Records PayoutAgent's real, executed payout on the claim. */
export function recordPayout(id, { payoutTxHash }) {
  const claim = findClaim(id);
  if (!claim) throw new Error(`Claim ${id} not found.`);
  claim.status = 'approved';
  claim.payoutTxHash = payoutTxHash;
  return claim;
}

/** Executes the real Hedera transfer reimbursing Northbeam: reserve pool → PayableAgent's
 *  own account, in real mUSDC equal to the exact real dollar amount it originally lost. */
async function executePayoutTransfer(amount) {
  const client = getReservePoolClient();
  const tokenId = TokenId.fromString(process.env.HEDERA_MUSDC_TOKEN_ID);
  const smallestUnits = Math.round(amount * MUSDC_DECIMALS);
  const tx = new TransferTransaction()
    .addTokenTransfer(tokenId, getReservePoolAccountId(), -smallestUnits)
    .addTokenTransfer(tokenId, getPayableAgentAccountId(), smallestUnits);
  const submitted = await tx.execute(client);
  await submitted.getReceipt(client);
  return submitted.transactionId.toString();
}

/** Mounts the claim-filing, claim-listing, and investigation routes on an Express app. */
export function registerClaimRoutes(app) {
  app.post('/api/claims', (req, res) => {
    res.status(201).json(createClaim(req.body));
  });

  app.get('/api/claims', (_req, res) => {
    res.status(200).json(listClaims());
  });

  app.post('/api/claims/:id/investigate', async (req, res) => {
    const claim = findClaim(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found.' });

    try {
      const history = await fetchVendorPaymentHistory({ vendor: claim.vendor });
      const approvedAccountId = await readApprovedAccount({ vendorName: claim.vendor });
      const { verdict, reasoning } = judgeClaim({
        history,
        disputedAccountId: claim.account,
        disputedAmount: claim.amount,
        approvedAccountId,
      });
      res.status(200).json(recordVerdict(claim.id, { verdict, reasoning }));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post('/api/claims/:id/payout', async (req, res) => {
    const claim = findClaim(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found.' });

    try {
      // PayoutAgent never trusts the stored verdict blindly — it re-derives it itself from
      // the same real evidence before authorizing any payment.
      const history = await fetchVendorPaymentHistory({ vendor: claim.vendor });
      const approvedAccountId = await readApprovedAccount({ vendorName: claim.vendor });
      const { verdict: rederivedVerdict, reasoning: rederivedReasoning } = judgeClaim({
        history,
        disputedAccountId: claim.account,
        disputedAmount: claim.amount,
        approvedAccountId,
      });
      authorizePayout({ claim, rederivedVerdict, rederivedReasoning });

      const requiredSmallestUnits = Math.round(claim.amount * MUSDC_DECIMALS);
      const poolBalance = await fetchTokenBalance(getReservePoolAccountId(), process.env.HEDERA_MUSDC_TOKEN_ID);
      if (poolBalance < requiredSmallestUnits) {
        throw new Error('Reserve pool balance is too low to cover this payout.');
      }

      const payoutTxHash = await executePayoutTransfer(claim.amount);
      await logPaymentToHcs({
        kind: 'claim-payout',
        claimId: claim.id,
        accountId: getPayableAgentAccountId(),
        amount: requiredSmallestUnits,
        payoutTxHash,
      });

      res.status(200).json(recordPayout(claim.id, { payoutTxHash }));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });
}
