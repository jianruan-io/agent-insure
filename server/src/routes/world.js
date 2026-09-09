import { signRequest } from '@worldcoin/idkit-core/signing';

const VERIFY_BASE_URL = 'https://developer.world.org/api/v4/verify';

// Not a secret, and never varies by environment — this must match the identifier of
// the Action created in the Developer Portal's Actions tab (just a name/scope there;
// which credential it requires — Selfie Check — is chosen in code, via the
// `selfieCheckLegacy` preset passed to IDKitRequestWidget in SelfieModal.tsx).
// A constant, not an env var: there's exactly one caller, and it's not something
// anyone should need to change without also changing this file.
const CLAIM_ACTION = 'file-claim';

/**
 * Signs a fresh World ID connect request for the claim-filing Selfie Check action.
 * Pure local crypto — no network call. Throws if the app's own credentials
 * (app_id/rp_id/signing_key) haven't been set up yet, or if signing itself fails.
 */
export function createWorldRequest() {
  const signingKeyHex = process.env.WORLD_SIGNING_KEY;
  const appId = process.env.WORLD_APP_ID;
  const rpId = process.env.WORLD_RP_ID;
  const action = CLAIM_ACTION;

  if (!signingKeyHex || !appId || !rpId) {
    throw new Error('World ID is not configured yet — missing app_id, rp_id, or signing key.');
  }

  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex, action });

  return {
    app_id: appId,
    action,
    environment: process.env.WORLD_ENVIRONMENT || 'sandbox',
    rp_context: {
      rp_id: rpId,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      signature: sig,
    },
  };
}

/**
 * Forwards a completed IDKit proof to World's verify endpoint and reports whether
 * it's genuinely valid. Never trusts the frontend's own claim of success.
 */
export async function verifyWorldProof(proof) {
  const rpId = process.env.WORLD_RP_ID;
  if (!rpId) {
    throw new Error('World ID is not configured yet — missing rp_id.');
  }

  let response;
  try {
    response = await fetch(`${VERIFY_BASE_URL}/${rpId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof),
    });
  } catch (cause) {
    const error = new Error('Could not reach World to verify the proof.');
    error.cause = cause;
    throw error;
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // World's response wasn't JSON — fall through, treated as unverified below.
  }

  if (!response.ok || !body || body.error || body.success === false) {
    return { verified: false, reason: body?.error || `World rejected the proof (status ${response.status}).` };
  }

  return { verified: true };
}

/** Mounts the two Selfie Check routes on an Express app. */
export function registerWorldRoutes(app) {
  app.post('/api/world/request', (_req, res) => {
    try {
      res.json(createWorldRequest());
    } catch (error) {
      res.status(503).json({ error: error.message });
    }
  });

  app.post('/api/world/verify', async (req, res) => {
    try {
      res.json(await verifyWorldProof(req.body));
    } catch (error) {
      res.status(502).json({ verified: false, error: error.message });
    }
  });
}
