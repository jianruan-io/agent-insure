/**
 * InvestigatorAgent's one plain rule — not an AI call. The thing being insured is
 * PayableAgent's AI behavior; judging a claim about it doesn't itself need to be AI-driven,
 * and a stated, deterministic rule is more auditable for an insurance verdict than a model's
 * own black-box reasoning would be.
 */

/**
 * Confirms the disputed payment's own coverage fee genuinely settled (real evidence it was
 * an insured transaction, not an unrelated or invented one), then decides CLEARED or FRAUD
 * by comparing its destination against the vendor's real, locked ENS account. Pure.
 */
export function judgeClaim({ history, disputedAccountId, disputedAmount, approvedAccountId }) {
  const disputedPayment = history.find(
    (entry) => entry.accountId === disputedAccountId && Number(entry.amount) === Number(disputedAmount)
  );
  if (!disputedPayment || !disputedPayment.feeTxHash || !disputedPayment.paymentTxHash) {
    throw new Error("Could not confirm the disputed payment's coverage fee in Hedera history.");
  }

  if (disputedAccountId === approvedAccountId) {
    return { verdict: 'CLEARED', reasoning: `Matches the vendor's locked, approved account ${approvedAccountId}.` };
  }
  return { verdict: 'FRAUD', reasoning: `Does not match the vendor's locked, approved account ${approvedAccountId}.` };
}
