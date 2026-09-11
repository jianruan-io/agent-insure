import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppSidebar } from './components/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';
import { INITIAL_POOL_BALANCE } from './lib/claims/data';
import type { Claim } from './lib/claims/types';
import Overview from './routes/Overview';
import ClaimsQueue from './routes/ClaimsQueue';

// Both Northbeam and Agent Insure HQ run on localhost during the hackathon.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

export default function App() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [poolBalance, setPoolBalance] = useState(INITIAL_POOL_BALANCE);

  // Real claims Northbeam has actually filed — never a hardcoded seed list.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/claims`)
      .then((response) => response.json())
      .then((real: Claim[]) => {
        if (!cancelled) setClaims(real);
      })
      .catch(() => {
        // Best-effort — an empty queue on failure is a real, honest state, not a crash.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInvestigate(claimId: string) {
    const response = await fetch(`${API_URL}/api/claims/${claimId}/investigate`, { method: 'POST' });
    const updated: Claim = await response.json();
    if (!response.ok) return;
    setClaims((prev) => prev.map((c) => (c.id === claimId ? updated : c)));
  }

  async function handlePay(claimId: string) {
    const target = claims.find((c) => c.id === claimId);
    if (!target || target.status === 'approved') return;

    const response = await fetch(`${API_URL}/api/claims/${claimId}/payout`, { method: 'POST' });
    const updated: Claim = await response.json();
    if (!response.ok) return;
    setClaims((prev) => prev.map((c) => (c.id === claimId ? updated : c)));
    setPoolBalance((prev) => prev - target.amount);
  }

  return (
    <BrowserRouter>
      <SidebarProvider>
        <AppSidebar claims={claims} poolBalance={poolBalance} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview claims={claims} poolBalance={poolBalance} />} />
              <Route
                path="/claims"
                element={<ClaimsQueue claims={claims} onInvestigate={handleInvestigate} onPay={handlePay} />}
              />
            </Routes>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </BrowserRouter>
  );
}
