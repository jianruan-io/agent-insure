import { fetchVendorPaymentHistory } from '../hedera/mirror-node.js';
import { readApprovedAccount } from '../ens/read-rules.js';
import { judgeClaim } from '../investigator/judge-claim.js';

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
}
