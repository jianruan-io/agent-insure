/**
 * PayoutAgent's own judgment — never trusts InvestigatorAgent's stored verdict blindly.
 * Given the verdict/reasoning PayoutAgent just independently re-derived from the same real
 * evidence (Mirror Node history + ENS rules), confirms it actually matches what's stored,
 * confirms it's genuinely FRAUD (a CLEARED claim has no loss to reimburse), and confirms
 * the claim hasn't already been paid. Pure.
 */
export function authorizePayout({ claim, rederivedVerdict, rederivedReasoning }) {
  if (rederivedVerdict !== claim.verdict || rederivedReasoning !== claim.reasoning) {
    throw new Error("PayoutAgent's independent re-check does not match the recorded verdict — refusing to pay.");
  }
  if (claim.verdict !== 'FRAUD') {
    throw new Error('Claim was cleared — no fraud confirmed, nothing to reimburse.');
  }
  if (claim.status === 'approved') {
    throw new Error('Claim has already been paid — refusing to pay twice.');
  }
  return { authorized: true };
}
