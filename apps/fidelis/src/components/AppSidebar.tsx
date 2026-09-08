import { Inbox, LayoutGrid, Shield } from 'lucide-react';
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
} from './ui/sidebar';
import type { Claim } from '../lib/claims/types';

function money(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

interface AppSidebarProps {
  claims: Claim[];
  poolBalance: number;
}

/**
 * Fidelis Portal's permanent navigation shell. See spec TECH-623.
 */
export function AppSidebar({ claims, poolBalance }: AppSidebarProps) {
  const location = useLocation();

  const navItems = [
    { label: 'Overview', to: '/overview', icon: LayoutGrid },
    { label: 'Claims Queue', to: '/claims', icon: Inbox, badge: claims.length },
  ];

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
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                  <Link to={item.to}>
                    <item.icon />
                    <span className="flex flex-1 items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      {item.badge != null && (
                        <span className="text-xs tabular-nums text-sidebar-foreground/45">{item.badge}</span>
                      )}
                    </span>
                  </Link>
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
          <div className="text-sm font-bold tabular-nums">{money(poolBalance)}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
