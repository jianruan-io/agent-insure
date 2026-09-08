import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppSidebar } from './components/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';
import { SEED_CLAIMS, INITIAL_POOL_BALANCE } from './lib/claims/data';
import { investigateClaim, payClaim } from './lib/claims/transitions';
import type { Claim } from './lib/claims/types';
import Overview from './routes/Overview';
import ClaimsQueue from './routes/ClaimsQueue';

export default function App() {
  const [claims, setClaims] = useState<Claim[]>(SEED_CLAIMS);
  const [poolBalance, setPoolBalance] = useState(INITIAL_POOL_BALANCE);

  function handleInvestigate(claimId: string) {
    setClaims((prev) => prev.map((c) => (c.id === claimId ? investigateClaim(c) : c)));
  }

  function handlePay(claimId: string) {
    setClaims((prev) => {
      let nextPoolBalance = poolBalance;
      const next = prev.map((c) => {
        if (c.id !== claimId) return c;
        const result = payClaim(c, poolBalance);
        nextPoolBalance = result.poolBalance;
        return result.claim;
      });
      setPoolBalance(nextPoolBalance);
      return next;
    });
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
