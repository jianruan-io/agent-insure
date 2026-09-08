import { useEffect, useState } from 'react';
import { Button } from './ui/button.js';

/** Hand-drawn stroke SVG matching the approved Northbeam Portal prototype's close icon —
 *  same convention as AppSidebar.tsx/Overview.tsx (never an icon-library glyph). The 🧑
 *  and ✅ inside the viewfinder/verified line below are the one intentional emoji
 *  exception, matching the published prototype exactly. */
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

/**
 * The Live Selfie Check modal opened from an `awaiting-identity` claim card. Reproduces
 * the published prototype's `openSelfieModal()`: a dashed-circle viewfinder with a
 * scanning-line CSS animation and "Scanning face… hold still" for ~1.4s (~200ms under
 * `prefers-reduced-motion`, same as the `.selfie-scan-line` rule in index.css), then swaps
 * to "Identity verified" with a Continue action that hands control back to the caller —
 * Claims.tsx marks the claim `submitted` and closes the modal.
 */
export function SelfieModal({ onClose, onComplete }: SelfieModalProps) {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let reduceMotion = false;
    try {
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      // matchMedia can throw in some embedded/test environments — treat as "no preference".
    }
    const timer = window.setTimeout(() => setVerified(true), reduceMotion ? 200 : 1400);
    return () => window.clearTimeout(timer);
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

        <div className="selfie-viewfinder">
          <span>🧑</span>
          <div className="selfie-scan-line" />
        </div>

        {verified ? (
          <div className="mb-4 text-sm font-semibold text-[var(--success)]">
            ✅ Identity verified — Guardian, AP Controller
          </div>
        ) : (
          <div className="mb-4 text-sm text-muted-foreground">Scanning face… hold still</div>
        )}

        {verified ? (
          <Button onClick={onComplete}>Continue</Button>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
