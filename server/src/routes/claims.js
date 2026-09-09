let nextClaimId = 1;

/**
 * Creates one real claim record — the shared anchor the identity check, the
 * investigator, and the eventual payout will all reference, instead of each
 * screen trusting its own locally-invented id.
 */
export function createClaim({ vendor, amount, activityId }) {
  const claim = {
    id: `claim-${nextClaimId}`,
    vendor,
    amount,
    activityId,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  nextClaimId += 1;
  return claim;
}

/** Mounts the claim-filing route on an Express app. */
export function registerClaimRoutes(app) {
  app.post('/api/claims', (req, res) => {
    res.status(201).json(createClaim(req.body));
  });
}
