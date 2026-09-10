import type { Claim } from './types';

export const INITIAL_POOL_BALANCE = 48800;

export const SEED_CLAIMS: Claim[] = [
  {
    id: 'c0',
    vendor: 'Global Freight Co',
    amount: 1200,
    time: 'last month',
    status: 'approved',
    investigated: true,
    verdict: 'FRAUD',
    reasoning: 'New account, never paid before. Outside the locked vendor list.',
  },
  {
    id: 'c1',
    vendor: 'Acme Corp',
    amount: 500,
    time: '12 minutes ago',
    status: 'submitted',
    investigated: false,
    verdict: null,
    reasoning:
      'New account for this vendor — never paid before. Outside the locked vendor list. Looks like manipulation, not a normal decision.',
  },
];
