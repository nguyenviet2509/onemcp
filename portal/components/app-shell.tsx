import { Suspense, type ReactNode } from 'react';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNav } from './sidebar-nav';
import { SidebarSecondaryNav } from './sidebar-secondary-nav';
import { SpaceSwitcher } from './space-switcher';
import { SavedSearchesList } from './saved-searches-list';
import { IdentifyAsDropdown } from './identify-as-dropdown';
import { ThemeToggle } from './theme-toggle';

interface AppShellProps {
  children: ReactNode;
}

// Root app shell — fixed 240px sidebar + flex main content area.
// Sidebar uses CSS var tokens (bg-sidebar, border-sidebar-border) for theme-awareness.
// SpaceProvider must wrap this component (done in layout.tsx).
// SSO not ready — no /login bypass needed yet; layout wraps ALL routes.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Fixed-width sidebar */}
      <aside
        className="flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto"
        aria-label="Sidebar"
      >
        {/* Brand: logo + version + identity */}
        <SidebarBrand />

        {/* SPACE section: prominent card-style switcher */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Space
          </p>
          <Suspense fallback={null}>
            <SpaceSwitcher />
          </Suspense>
        </div>

        {/* Primary nav: 5 items with icons */}
        <SidebarNav />

        {/* SAVED SEARCHES section */}
        <div className="flex-1 border-t border-sidebar-border">
          <div className="px-3 pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Saved searches
            </p>
          </div>
          <SavedSearchesList />
        </div>

        {/* Secondary nav + identity + theme toggle at bottom */}
        <div className="border-t border-sidebar-border pt-2">
          <SidebarSecondaryNav />
          {/* IdentifyAsDropdown kept until SSO ships */}
          <div className="px-3 pb-3 space-y-2">
            <IdentifyAsDropdown />
            {/* Theme toggle — text-only, zero icon budget */}
            <div className="flex justify-end">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
