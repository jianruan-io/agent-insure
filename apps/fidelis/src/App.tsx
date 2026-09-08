import { AppSidebar } from './components/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';

export default function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6" />
      </SidebarInset>
    </SidebarProvider>
  );
}
