import { TransferTransaction, Hbar } from '@hiero-ledger/sdk';
import { fetchVendorPaymentHistory, fetchAccountBalance } from '../hedera/mirror-node.js';
import { readApprovedAccount } from '../ens/read-rules.js';
import { judgeClaim } from '../investigator/judge-claim.js';
import { authorizePayout } from '../payout/authorize-payout.js';
import { getReservePoolClient, getReservePoolAccountId, getPayableAgentAccountId } from '../hedera/client.js';
import { logPaymentToHcs } from '../hedera/hcs.js';
import { VENDOR_TRANSFER_TINYBARS } from './activity.js';

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
 *  own account, for the exact fixed amount it originally lost. */
async function executePayoutTransfer() {
  const client = getReservePoolClient();
  const tinybars = VENDOR_TRANSFER_TINYBARS;
  const tx = new TransferTransaction()
    .addHbarTransfer(getReservePoolAccountId(), Hbar.fromTinybars(`-${tinybars}`))
    .addHbarTransfer(getPayableAgentAccountId(), Hbar.fromTinybars(tinybars));
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

      const poolBalance = await fetchAccountBalance(getReservePoolAccountId());
      if (poolBalance < Number(VENDOR_TRANSFER_TINYBARS)) {
        throw new Error('Reserve pool balance is too low to cover this payout.');
      }

      const payoutTxHash = await executePayoutTransfer();
      await logPaymentToHcs({
        kind: 'claim-payout',
        claimId: claim.id,
        accountId: getPayableAgentAccountId(),
        amount: VENDOR_TRANSFER_TINYBARS,
        payoutTxHash,
      });

      res.status(200).json(recordPayout(claim.id, { payoutTxHash }));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });
}
