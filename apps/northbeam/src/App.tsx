import type { CSSProperties } from 'react';
import { AppSidebar } from './components/AppSidebar.js';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar.js';

/** DESIGN.northbeam.md's Layout section fixes the sidebar at 240px — wider than the
 *  shared primitive's own 12rem default — so it's set here via the CSS variable the
 *  primitive already reads, rather than editing the verbatim-copied sidebar.tsx. */
const SIDEBAR_STYLE = { '--sidebar-width': '240px' } as CSSProperties;

/**
 * The permanent application shell: sidebar + a bare placeholder main area. Overview and
 * every other screen are separate, later pieces of work — this issue is the navigation
 * shell only.
 */
export default function App() {
  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1" />
      </SidebarInset>
    </SidebarProvider>
  );
}
