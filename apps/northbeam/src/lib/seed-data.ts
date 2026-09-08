/**
 * Hardcoded rules/activity/claims matching the published prototype's `seedState()`. The
 * prototype keeps this in localStorage and mutates it as the demo is clicked through;
 * Overview is the only real screen so far, so there's nothing to mutate yet — this is a
 * static snapshot of that same seed state, scoped to the fields Overview reads.
 */

export interface Vendor {
  name: string;
  /** Truncated wallet address, e.g. "0x492b…c11a" — always rendered in the mono track. */
  account: string;
}

export interface ActivityEntry {
  id: string;
  vendor: string;
  account: string;
  amount: number;
  time: string;
  flagged: boolean;
}

export type ClaimStatus = 'approved' | 'submitted' | 'awaiting-identity';

export interface ClaimEntry {
  id: string;
  vendor: string;
  amount: number;
  time: string;
  status: ClaimStatus;
}

export const rules = {
  budgetCap: 5000,
  locked: false,
  vendors: [{ name: 'Acme Corp', account: '0x492b…c11a' }] as Vendor[],
};

/** The two seeded Acme Corp payments — both matched the locked vendor list, so both
 *  cleared "OK". Chronological order (oldest first), matching the prototype's array. */
export const activity: ActivityEntry[] = [
  { id: 'a1', vendor: 'Acme Corp', account: '0x492b…c11a', amount: 500, time: 'Mon 9:03 AM', flagged: false },
  { id: 'a2', vendor: 'Acme Corp', account: '0x492b…c11a', amount: 500, time: 'Wed 2:15 PM', flagged: false },
];

/** One seeded, already-resolved claim — filed and paid before this demo's timeline
 *  starts, so Overview's lifetime counters read 1 filed / 1 paid on a fresh load. */
export const claims: ClaimEntry[] = [
  { id: 'c0', vendor: 'Global Freight Co', amount: 1200, time: 'last month', status: 'approved' },
];
