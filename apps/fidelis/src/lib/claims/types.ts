export type ClaimStatus = 'submitted' | 'approved';

export interface Claim {
  id: string;
  vendor: string;
  amount: number;
  time: string;
  status: ClaimStatus;
  investigated: boolean;
  verdict: 'FRAUD' | null;
  reasoning: string;
}
