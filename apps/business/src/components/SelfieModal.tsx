import { useEffect, useRef, useState } from 'react';
import { IDKit, selfieCheckLegacy, type IDKitRequest } from '@worldcoin/idkit-core';
import QRCode from 'qrcode';
import { Button } from './ui/button.js';

/** Hand-drawn stroke SVG matching the approved Northbeam Portal prototype's close icon —
 *  same convention as AppSidebar.tsx/Overview.tsx (never an icon-library glyph). */
function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface SelfieModalProps {
  onClose: () => void;
  onComplete: () => void;
}

interface WorldRequestConfig {
  app_id: `app_${string}`;
  action: string;
  environment?: 'production' | 'staging' | 'sandbox';
  rp_context: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
}

type Status = 'loading' | 'ready' | 'verifying' | 'verified' | 'error';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

/**
 * The Live Selfie Check modal opened from an `awaiting-identity` claim card. Talks to
 * World's real API directly through `@worldcoin/idkit-core`'s framework-agnostic
 * `createRequest()` builder — not the `IDKitRequestWidget` React component, whose bundled
 * WASM module fails to load under Vite's dev server (an SDK/tooling bug unrelated to World's
 * own servers: confirmed zero network requests ever reach worldcoin.org/world.org before it
 * fails). `createRequest()` needs no WASM at all; it just returns a real, signed
 * `connectorURI` to render as a QR code (any plain QR library works — no widget required)
 * and a `pollUntilCompletion()` promise that resolves once the real device completes the
 * scan. Every returned proof is still independently checked with the backend (`POST
 * /api/world/verify`) before `onComplete` ever fires — a failed or not-yet-enabled check
 * shows a real error instead of silently succeeding.
 */
export function SelfieModal({ onClose, onComplete }: SelfieModalProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function run() {
      let request: IDKitRequest;
      try {
        const response = await fetch(`${API_URL}/api/world/request`, { method: 'POST' });
        const config = (await response.json()) as WorldRequestConfig & { error?: string };
        if (!response.ok) throw new Error(config.error || 'Could not start the identity check.');
        if (cancelledRef.current) return;

        request = await IDKit.request({
          app_id: config.app_id,
          action: config.action,
          rp_context: config.rp_context,
          environment: config.environment,
          allow_legacy_proofs: true,
        }).preset(selfieCheckLegacy());
        if (cancelledRef.current) return;

        const dataUrl = await QRCode.toDataURL(request.connectorURI, { width: 240, margin: 1 });
        if (cancelledRef.current) return;
        setQrDataUrl(dataUrl);
        setStatus('ready');
      } catch (error) {
        if (!cancelledRef.current) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not start the identity check.');
          setStatus('error');
        }
        return;
      }

      // World's own SDK reports exactly why a check failed via `error` (a fixed, documented
      // set of reasons — e.g. "world_id_4_not_available", "connection_failed") — surfaced
      // directly rather than hidden behind one generic message.
      const completion = await request.pollUntilCompletion();
      if (cancelledRef.current) return;
      if (!completion.success) {
        // eslint-disable-next-line no-console
        console.error('World ID identity check failed', { errorCode: completion.error, debugReport: request.getDebugReport() });
        setErrorMessage(`Identity check failed: ${completion.error}`);
        setStatus('error');
        return;
      }

      setStatus('verifying');
      try {
        const verifyResponse = await fetch(`${API_URL}/api/world/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(completion.result),
        });
        const verifyBody = await verifyResponse.json();
        if (cancelledRef.current) return;
        if (!verifyResponse.ok || !verifyBody.verified) {
          setErrorMessage(verifyBody.error || verifyBody.reason || 'Identity check failed — please try again.');
          setStatus('error');
          return;
        }
        setStatus('verified');
      } catch (error) {
        if (!cancelledRef.current) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not verify the identity check.');
          setStatus('error');
        }
      }
    }

    void run();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        // Only a direct click on the backdrop itself closes the modal — matches the
        // prototype's `.modal-backdrop` click check, so clicks inside the card don't bubble
        // into a close.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-6 text-center shadow-[0_12px_32px_rgba(0,0,0,.16)]">
        <button
          type="button"
          className="mb-1 ml-auto block text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <CloseIcon />
        </button>

        {status === 'verified' ? (
          <>
            <div className="selfie-viewfinder">
              <span>🧑</span>
            </div>
            <div className="mb-4 text-sm font-semibold text-[var(--success)]">
              ✅ Identity verified — Guardian, AP Controller
            </div>
            <Button onClick={onComplete}>Continue</Button>
          </>
        ) : status === 'error' ? (
          <>
            <div className="mb-4 text-sm font-semibold text-red-600">⚠️ {errorMessage}</div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </>
        ) : status === 'loading' ? (
          <>
            <div className="selfie-viewfinder">
              <span>🧑</span>
              <div className="selfie-scan-line" />
            </div>
            <div className="mb-4 text-sm text-muted-foreground">Starting the identity check…</div>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </>
        ) : qrDataUrl ? (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              {status === 'verifying' ? 'Confirming your scan…' : 'Scan the code with the World app to continue.'}
            </div>
            <img src={qrDataUrl} alt="World ID verification QR code" className="mx-auto mb-4 rounded-lg" width={240} height={240} />
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
