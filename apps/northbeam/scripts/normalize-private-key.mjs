// Shared by register-agentinsure-eth.mjs and e2e/lock-rules.spec.ts — both take
// SEPOLIA_PRIVATE_KEY from the same root .env.local and need the same tolerance for
// common paste slips (stray whitespace, quotes, a missing 0x prefix).
export function normalizePrivateKey(raw) {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return undefined;
  const hex = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `SEPOLIA_PRIVATE_KEY doesn't look like a raw private key (got ${trimmed.length} characters after trimming ` +
        `whitespace/quotes/0x — expected exactly 64 hex characters). If this was copied from a wallet's "Secret ` +
        `Recovery Phrase" (a list of words), export the private key for one specific account instead — that's a ` +
        `different, single hex value.`
    );
  }
  return `0x${hex}`;
}
