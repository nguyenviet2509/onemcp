import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
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

// Root shell — 240px sidebar + flex main. Sidebar sections share the same
// small-caps section header treatment for a single consistent style.
// Icon budget: 5 total, all in SidebarNav. Bottom cluster is text-only.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className="flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto"
        aria-label="Sidebar"
      >
        <SidebarBrand />

        {/* Quick search entry — text-only, links to /search. Command palette hint
            reserved for future ⌘K wiring; kbd shown as visual affordance only. */}
        <div className="px-2 pt-2">
          <Link
            href="/search"
            className="flex items-center justify-between rounded-md border border-sidebar-border/70 bg-background/30 px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-sidebar-border hover:text-foreground"
          >
            <span className="truncate">Search artifacts…</span>
            <kbd className="ml-2 rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              ⌘K
            </kbd>
          </Link>
        </div>

        {/* SPACE — subtle section header, matches Account/Saved */}
        <div className="px-2 pt-3">
          <SectionHeader>Space</SectionHeader>
          <div className="px-0.5">
            <Suspense fallback={null}>
              <SpaceSwitcher />
            </Suspense>
          </div>
        </div>

        {/* NAVIGATE — 5 primary items with icons */}
        <div className="pt-3">
          <div className="px-2">
            <SectionHeader className="px-2.5">Navigate</SectionHeader>
          </div>
          <SidebarNav />
        </div>

        {/* SAVED — searches list; grows to fill remaining space */}
        <div className="flex-1 pt-3">
          <div className="px-2">
            <SectionHeader className="px-2.5">Saved searches</SectionHeader>
          </div>
          <SavedSearchesList />
        </div>

        {/* ACCOUNT — text-only nav; identity + theme in a compact bottom row */}
        <div className="border-t border-sidebar-border pt-2">
          <SidebarSecondaryNav />
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-sidebar-border/70 px-3 py-2">
            <div className="min-w-0 flex-1">
              <IdentifyAsDropdown />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

// Shared section header — uppercase micro-caps used across all sidebar sections
// to enforce a single visual style.
function SectionHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}
