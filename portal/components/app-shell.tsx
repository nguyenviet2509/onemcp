import { Suspense, type ReactNode } from 'react';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNav } from './sidebar-nav';
import { SidebarSecondaryNav } from './sidebar-secondary-nav';
import { SpaceSwitcher } from './space-switcher';
import { SavedSearchesList } from './saved-searches-list';
import { IdentifyAsDropdown } from './identify-as-dropdown';

interface AppShellProps {
  children: ReactNode;
}

// Root app shell — fixed 240px sidebar + flex main content area.
// Dark-first: root bg-slate-950, sidebar bg-slate-900.
// SpaceProvider must wrap this component (done in layout.tsx).
// SSO not ready — no /login bypass needed yet; layout wraps ALL routes.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Fixed-width sidebar */}
      <aside
        className="flex w-60 shrink-0 flex-col bg-slate-900 border-r border-slate-800 overflow-y-auto"
        aria-label="Sidebar"
      >
        {/* Brand: logo + version + identity */}
        <SidebarBrand />

        {/* SPACE section: prominent card-style switcher */}
        <div className="px-3 py-3 border-b border-slate-800">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Space
          </p>
          <Suspense fallback={null}>
            <SpaceSwitcher />
          </Suspense>
        </div>

        {/* Primary nav: 5 items with icons */}
        <SidebarNav />

        {/* SAVED SEARCHES section */}
        <div className="flex-1 border-t border-slate-800">
          <div className="px-3 pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Saved searches
            </p>
          </div>
          <SavedSearchesList />
        </div>

        {/* Secondary nav + identity at bottom */}
        <div className="border-t border-slate-800 pt-2">
          <SidebarSecondaryNav />
          {/* IdentifyAsDropdown kept until SSO ships */}
          <div className="px-3 pb-4">
            <IdentifyAsDropdown />
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
