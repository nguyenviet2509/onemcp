import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNav } from './sidebar-nav';
import { SidebarSecondaryNav } from './sidebar-secondary-nav';
import { SpaceSwitcher } from './space-switcher';
import { SidebarUserCard } from './sidebar-user-card';

interface AppShellProps {
  children: ReactNode;
}

// Root shell — 240px sidebar + flex main. Sections share the same small-caps
// header for a single consistent style. Icon budget: 5 total, all in SidebarNav.
// Bottom pill (SidebarUserCard) absorbs identity actions + theme toggle so the
// footer stays a single row per Option A mockup.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className="flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto"
        aria-label="Sidebar"
      >
        <SidebarBrand />

        {/* Quick search — text-only link; ⌘K hint reserved for future palette wiring. */}
        <div className="px-2 pt-2">
          <Link
            href="/search"
            className="flex items-center justify-between rounded-md border border-sidebar-border/70 bg-background/30 px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-sidebar-border hover:text-foreground"
          >
            <span className="truncate">Search or jump to…</span>
            <kbd className="ml-2 rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              ⌘K
            </kbd>
          </Link>
        </div>

        <div className="px-2 pt-3">
          <SectionHeader>Space</SectionHeader>
          <div className="px-0.5">
            <Suspense fallback={null}>
              <SpaceSwitcher />
            </Suspense>
          </div>
        </div>

        <div className="pt-3">
          <div className="px-2">
            <SectionHeader className="px-2.5">Navigate</SectionHeader>
          </div>
          <SidebarNav />
        </div>

        {/* Account nav grows to fill remaining space so user card stays pinned to bottom. */}
        <div className="mt-3 flex-1 border-t border-sidebar-border pt-2">
          <SidebarSecondaryNav />
        </div>

        <SidebarUserCard />
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

function SectionHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}
