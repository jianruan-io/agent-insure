import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { normalizePrivateKey } from '../business/scripts/normalize-private-key.mjs';

test.use({ baseURL: 'http://localhost:6323' });

/**
 * No mocking of the ENS/chain interaction itself — every call this test drives hits the
 * real hackathon ENSv2 Sepolia deployment for real, through the real `ens.ts` client the
 * app ships with. The one substitution: Playwright cannot click a real MetaMask extension
 * popup, so `window.ethereum` is replaced with a thin shim that forwards every request to
 * a real viem wallet client running in this test's own Node process, holding the same
 * `SEPOLIA_PRIVATE_KEY` PayableAgent's wallet uses live (root `.env.local`). Every
 * signature, transaction, and confirmation that flows through it is real — this only
 * substitutes for the human clicking "Confirm" in a wallet UI, the same category of thing
 * p3-file-the-claim.spec.ts documents for a physical device Playwright can't drive either.
 * Added 2026-09-09 for TECH-606.
 */

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env.local', import.meta.url)));
} catch {
  // No root .env.local — the test.skip just below reports this clearly instead.
}

const TEST_SIGNER_KEY = normalizePrivateKey(process.env.SEPOLIA_PRIVATE_KEY) as Hex | undefined;
const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

test.skip(
  !TEST_SIGNER_KEY,
  'SEPOLIA_PRIVATE_KEY is not set in the repo root .env.local — this test drives real Sepolia transactions and needs a funded test wallet. See this file’s header comment.'
);

async function installTestSigner(page: Page) {
  const account = privateKeyToAccount(TEST_SIGNER_KEY as Hex);
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

  await page.exposeFunction('__testSignerRequest', async ({ method, params }: { method: string; params?: unknown[] }) => {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [account.address];
      case 'eth_chainId':
        return `0x${sepolia.id.toString(16)}`;
      case 'eth_sendTransaction': {
        const [tx] = params as [{ to: Hex; data: Hex; value?: Hex }];
        const hash = await walletClient.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined });
        await publicClient.waitForTransactionReceipt({ hash });
        return hash;
      }
      default:
        throw new Error(`Test signer does not support ${method}`);
    }
  });

  await page.addInitScript(() => {
    (window as unknown as { ethereum: unknown }).ethereum = {
      isMetaMask: true,
      request: (args: { method: string; params?: unknown[] }) =>
        (window as unknown as { __testSignerRequest: (a: typeof args) => Promise<unknown> }).__testSignerRequest(args),
      on: () => {},
      removeListener: () => {},
    };
  });
}

test.describe('AP controller locks PayableAgent’s spending rules on real ENS text records', () => {
  test('the budget cap and vendor list are written and locked on-chain, with real proof shown', async ({ page }) => {
    // Real Sepolia confirmations (write, then lock) can each take real block time —
    // well beyond Playwright's 30s default.
    test.setTimeout(180_000);

    await installTestSigner(page);
    await page.goto('/rules');

    // The page's own on-chain read (`syncRulesFromChain`) is async — wait for it to
    // actually resolve into one of its two possible states before deciding which branch
    // of this test to take. Checking `isVisible()` immediately races that read and can
    // click a button that's about to disappear once the real state comes back.
    const alreadyLocked = await page
      .getByText('Locked on ENS')
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (alreadyLocked) {
      // The Enhanced Access Control lock is permanent — a prior real run already revoked
      // this test wallet's write permission. Re-running only re-confirms that fact.
      //
      // Only "Locked on ENS" is asserted here, not a tx hash: a transaction hash isn't
      // on-chain *state*, only a read-only sync can re-derive here — it only ever exists
      // in the browser session that performed the write/lock, which the fresh-flow branch
      // below covers.
      await test.step('confirm the already-locked state carries real on-chain proof', async () => {
        await expect(page.getByText('Locked on ENS')).toBeVisible();
      });
      await test.step("independent proof on ENS's own public explorer — not our app's word for it", async () => {
        const namePage = await page.context().newPage();
        await namePage.goto('https://hackathon-deployment-portal-app.ens-cf.workers.dev/agentinsure.eth');
        await expect(namePage.getByText('agentinsure.eth')).toBeVisible({ timeout: 15_000 });
        await expect(namePage.getByText('Owner')).toBeVisible();
        await namePage.close();

        const ensPage = await page.context().newPage();
        await ensPage.goto('https://hackathon-deployment-portal-app.ens-cf.workers.dev/resolver/0x8B6195c5A125201FA3C63fb6637A8a70105d6e5c');
        await expect(ensPage.getByText('ENS Permissioned Resolver')).toBeVisible({ timeout: 15_000 });
        await expect(ensPage.getByText(/0x8B61.*6e5c/).first()).toBeVisible();
        await ensPage.close();
      });
      return;
    }

    await test.step('click Lock Rules On-Chain and let the real write + lock flow run', async () => {
      await page.getByRole('button', { name: /Lock Rules On-Chain|Finish Locking On-Chain/ }).click();
    });

    await test.step('the budget cap and vendor list are written to a real ENS text record', async () => {
      await expect(page.getByText(/write tx: 0x/)).toBeVisible({ timeout: 120_000 });
    });

    await test.step('the write permission is revoked and the screen reflects a real on-chain lock', async () => {
      await expect(page.getByText('Locked on ENS')).toBeVisible({ timeout: 120_000 });
      await expect(page.getByText(/lock tx: 0x/)).toBeVisible();
    });
  });
});
