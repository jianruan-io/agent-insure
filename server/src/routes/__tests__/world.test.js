import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@worldcoin/idkit-core/signing', () => ({
  signRequest: vi.fn(),
}));

const { signRequest } = await import('@worldcoin/idkit-core/signing');
const { createWorldRequest, verifyWorldProof } = await import('../world.js');

const ENV_KEYS = ['WORLD_SIGNING_KEY', 'WORLD_APP_ID', 'WORLD_RP_ID', 'WORLD_ACTION_ID', 'WORLD_ENVIRONMENT'];

function setConfiguredEnv() {
  process.env.WORLD_SIGNING_KEY = '0xabc123';
  process.env.WORLD_APP_ID = 'app_test';
  process.env.WORLD_RP_ID = 'rp_test';
  process.env.WORLD_ACTION_ID = 'file-claim';
  process.env.WORLD_ENVIRONMENT = 'sandbox';
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe('createWorldRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearEnv();
  });

  it('creates a signed connect request when World is configured', () => {
    setConfiguredEnv();
    vi.mocked(signRequest).mockReturnValue({
      sig: '0xsig',
      nonce: '0xnonce',
      createdAt: 1000,
      expiresAt: 1300,
    });

    const request = createWorldRequest();

    expect(request.app_id).toBe('app_test');
    expect(request.rp_context).toEqual({
      rp_id: 'rp_test',
      nonce: '0xnonce',
      created_at: 1000,
      expires_at: 1300,
      signature: '0xsig',
    });
  });

  it('throws a clear error when the signing key is not configured yet', () => {
    setConfiguredEnv();
    delete process.env.WORLD_SIGNING_KEY;

    expect(() => createWorldRequest()).toThrow(/not configured/i);
  });

  it("throws a clear error when World's own signing step fails", () => {
    setConfiguredEnv();
    vi.mocked(signRequest).mockImplementation(() => {
      throw new Error('bad key format');
    });

    expect(() => createWorldRequest()).toThrow('bad key format');
  });
});

describe('verifyWorldProof', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearEnv();
    setConfiguredEnv();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('confirms a valid, unused proof as verified', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const result = await verifyWorldProof({ proof: 'ok' });

    expect(result.verified).toBe(true);
  });

  it('rejects an invalid or expired proof', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_proof' }),
    });

    const result = await verifyWorldProof({ proof: 'bad' });

    expect(result.verified).toBe(false);
  });

  it('rejects a proof that has already been used once', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'already_verified' }),
    });

    const result = await verifyWorldProof({ proof: 'reused' });

    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/already_verified/);
  });

  it("throws a clear error when World's verify endpoint is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    await expect(verifyWorldProof({ proof: 'x' })).rejects.toThrow(/reach World/i);
  });
});
