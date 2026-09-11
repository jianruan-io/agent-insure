export type ClaimStatus = 'draft' | 'submitted' | 'approved';

export interface Claim {
  id: string;
  vendor: string;
  amount: number;
  /** The real disputed Hedera account — what PayableAgent actually paid, compared against
   *  the vendor's real, locked ENS account when investigated. */
  account: string;
  status: ClaimStatus;
  investigated: boolean;
  verdict: 'FRAUD' | 'CLEARED' | null;
  reasoning: string | null;
  /** The real Hedera transaction hash for the claim payout, once PayoutAgent has executed it. */
  payoutTxHash: string | null;
}
