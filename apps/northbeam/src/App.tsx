import type { CSSProperties } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppSidebar } from './components/AppSidebar.js';
import { DemoBar } from './components/DemoBar.js';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar.js';
import { StoreProvider } from './lib/store.js';
import { Activity } from './pages/Activity.js';
import { Claims } from './pages/Claims.js';
import { Overview } from './pages/Overview.js';
import { Rules } from './pages/Rules.js';

/** DESIGN.northbeam.md's Layout section fixes the sidebar at 240px — wider than the
 *  shared primitive's own 12rem default — so it's set here via the CSS variable the
 *  primitive already reads, rather than editing the verbatim-copied sidebar.tsx. */
const SIDEBAR_STYLE = { '--sidebar-width': '240px' } as CSSProperties;

/**
 * The permanent application shell: the demo-guide bar, sidebar, and the four real routes
 * behind it (Overview, Rules, Activity, Claims). `StoreProvider` wraps everything so all
 * four screens share one localStorage-persisted state — locking rules on `/rules` is
 * immediately visible on `/` and `/activity`, filing a claim on `/claims` reflects back on
 * `/activity`, etc.
 */
export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <div className="flex min-h-svh flex-col">
          <DemoBar />
          {/* The ported shadcn Sidebar primitive pins its desktop panel to the viewport's
           *  top edge (`inset-y-0`) with no prop to offset it — it assumes it owns the whole
           *  viewport, which was true before the demo bar existed. Per the CSS spec, giving
           *  this wrapper any non-`none` `transform` makes it the containing block for
           *  `position: fixed` descendants, so the panel anchors to *this* box (which starts
           *  right below the demo bar) instead of the viewport — without editing the
           *  primitive itself. */}
          <div className="relative min-h-0 flex-1" style={{ transform: 'translateZ(0)' }}>
            <SidebarProvider style={SIDEBAR_STYLE} className="h-full min-h-full">
              <AppSidebar />
              <SidebarInset className="min-h-0">
                <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
                  <SidebarTrigger />
                </header>
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                  <Routes>
                    <Route path="/" element={<Overview />} />
                    <Route path="/rules" element={<Rules />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/claims" element={<Claims />} />
                  </Routes>
                </main>
              </SidebarInset>
            </SidebarProvider>
          </div>
        </div>
      </BrowserRouter>
    </StoreProvider>
  );
}
