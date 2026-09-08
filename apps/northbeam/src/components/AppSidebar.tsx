import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar.js';

/** Hand-drawn stroke SVGs matching the approved Northbeam Portal prototype's icon set —
 *  never an icon-library glyph or emoji — so the shell is pixel-faithful to what was
 *  already signed off. */
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.4" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.4" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.4" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="12" y2="15" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2,11 6,11 8,4 12,17 14,11 18,11" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
      <path d="M11 2.5v4h4" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="2.5" width="12" height="15" rx="1.5" />
      <rect x="7" y="5.5" width="2" height="2" />
      <rect x="11" y="5.5" width="2" height="2" />
      <rect x="7" y="9.5" width="2" height="2" />
      <rect x="11" y="9.5" width="2" height="2" />
      <rect x="8.2" y="13.5" width="3.6" height="4" />
    </svg>
  );
}

/** The four primary screens, each a real route now that Rules, Activity, and Claims
 *  exist behind their own paths. */
const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: GridIcon },
  { path: '/rules', label: 'Rules', icon: ListIcon },
  { path: '/activity', label: 'Activity', icon: ActivityIcon },
  { path: '/claims', label: 'Claims', icon: FileIcon },
] as const;

/**
 * Northbeam's permanent navigation shell: brand mark, the four primary screens, and the
 * signed-in Guardian's footer identity. Built on the shared shadcn Sidebar primitive —
 * `collapsible="icon"` gives desktop-only icon-rail collapsing, while the primitive's own
 * mobile behavior (a full slide-in Sheet, never a collapsed rail) covers the phone-sized
 * case for free. Nav items are real `react-router-dom` `Link`s (via `SidebarMenuButton`'s
 * `asChild`), with the active route highlighted from `useLocation()`.
 */
export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <BuildingIcon />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-bold">Northbeam</div>
            <div className="truncate text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/55">
              Distributors · Insured
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                    <Link to={item.path}>
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 rounded-lg p-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            G
          </span>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold">Guardian</div>
            <div className="truncate text-[11px] text-sidebar-foreground/55">AP Controller</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
