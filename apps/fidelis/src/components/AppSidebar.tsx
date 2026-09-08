import { Inbox, LayoutGrid, Shield } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutGrid },
  { label: 'Claims Queue', icon: Inbox, badge: 2 },
];

/**
 * Fidelis Portal's permanent navigation shell. Nav items are inert until each
 * screen lands as its own piece of work — see spec TECH-623.
 */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Shield className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-bold">Fidelis</span>
            <span className="truncate text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
              Agent Assurance · Insurer
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton>
                  <item.icon />
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    {item.badge != null && (
                      <span className="text-xs tabular-nums text-sidebar-foreground/45">{item.badge}</span>
                    )}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-lg p-2 group-data-[collapsible=icon]:hidden">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/55">
            Reserve pool
          </div>
          <div className="text-sm font-bold tabular-nums">$48,800</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
