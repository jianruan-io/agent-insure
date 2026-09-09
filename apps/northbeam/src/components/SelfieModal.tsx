import { useEffect, useState } from 'react';
import { IDKitRequestWidget, selfieCheckLegacy, type IDKitResult } from '@worldcoin/idkit';
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
 * The Live Selfie Check modal opened from an `awaiting-identity` claim card. Replaces the
 * old `setTimeout` fake with World's real IDKit widget: the backend signs a fresh connect
 * request (`POST /api/world/request`), the widget renders the actual World connect flow,
 * and every returned proof is independently checked with the backend (`POST
 * /api/world/verify`) before `onComplete` ever fires — a failed or not-yet-enabled check
 * shows a real error instead of silently succeeding.
 */
export function SelfieModal({ onClose, onComplete }: SelfieModalProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [requestConfig, setRequestConfig] = useState<WorldRequestConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRequest() {
      try {
        const response = await fetch(`${API_URL}/api/world/request`, { method: 'POST' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not start the identity check.');
        if (!cancelled) {
          setRequestConfig(body);
          setStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not start the identity check.');
          setStatus('error');
        }
      }
    }

    void loadRequest();
    return () => {
      cancelled = true;
    };
  }, []);

  // Called by IDKit with the proof once the person completes the check. Resolving lets
  // IDKit call onSuccess; throwing tells it the check failed — either way, the backend's
  // answer is what decides, never the widget's own say-so.
  async function handleVerify(result: IDKitResult) {
    setStatus('verifying');
    const response = await fetch(`${API_URL}/api/world/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    const body = await response.json();
    if (!response.ok || !body.verified) {
      const message = body.error || body.reason || 'Identity check failed — please try again.';
      setErrorMessage(message);
      setStatus('error');
      throw new Error(message);
    }
  }

  function handleSuccess() {
    setStatus('verified');
  }

  function handleWidgetError() {
    setErrorMessage('Identity check failed — please try again.');
    setStatus('error');
  }

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
        ) : requestConfig ? (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              {status === 'verifying' ? 'Confirming your scan…' : 'Scan the code with the World app to continue.'}
            </div>
            <IDKitRequestWidget
              open
              onOpenChange={(open) => {
                if (!open && status !== 'verified') onClose();
              }}
              app_id={requestConfig.app_id}
              action={requestConfig.action}
              environment={requestConfig.environment}
              rp_context={requestConfig.rp_context}
              allow_legacy_proofs={true}
              preset={selfieCheckLegacy()}
              handleVerify={handleVerify}
              onSuccess={handleSuccess}
              onError={handleWidgetError}
            />
            <Button variant="outline" onClick={onClose} className="mt-3">
              Cancel
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
