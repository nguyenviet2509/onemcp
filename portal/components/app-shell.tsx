import { type ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNav } from './sidebar-nav';
import { SidebarSecondaryNav } from './sidebar-secondary-nav';
import { SidebarUserCard } from './sidebar-user-card';
import { AuthChip } from './auth-chip';

// Auth mode read at server render time — controls sidebar bottom pill.
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE;

interface AppShellProps {
  children: ReactNode;
}

// Root shell — 240px sidebar + flex main. Sections share the same small-caps
// header for a single consistent style. Icon budget: 5 total, all in SidebarNav.
// Bottom pill (SidebarUserCard) absorbs identity actions + theme toggle so the
// footer stays a single row per Option A mockup.
export async function AppShell({ children }: AppShellProps) {
  const tSidebar = await getTranslations('sidebar');
  return (
    <div className="flex min-h-screen bg-background">
      {/* aside: 3-zone flex column — top fixed, middle scrollable, bottom fixed */}
      <aside
        className="flex w-60 shrink-0 flex-col h-screen sticky top-0 bg-sidebar border-r border-sidebar-border"
        aria-label="Sidebar"
      >
        {/* Top zone — fixed, never scrolls */}
        <div className="shrink-0">
          <SidebarBrand />

          {/* Quick search — text-only link; ⌘K hint reserved for future palette wiring. */}
          <div className="px-2 pt-2">
            <Link
              href="/search"
              className="flex items-center justify-between rounded-md border border-sidebar-border/70 bg-background/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-sidebar-border hover:text-foreground"
            >
              <span className="truncate">{tSidebar('searchOrJump')}</span>
              <kbd className="ml-2 rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                ⌘K
              </kbd>
            </Link>
          </div>

        </div>

        {/* Middle zone — scrollable nav; min-h-0 ensures flex child can shrink */}
        <div className="flex-1 min-h-0 overflow-y-auto pt-3">
          <div className="px-2">
            <SectionHeader className="px-2.5">{tSidebar('navigate')}</SectionHeader>
          </div>
          <SidebarNav />

          {/* Account nav */}
          <div className="mt-3 border-t border-sidebar-border pt-2">
            <SidebarSecondaryNav />
          </div>
        </div>

        {/* Bottom zone — always visible user pill.
            SSO mode: UserMenu (email + logout).
            trust-header (legacy): SidebarUserCard (identity + theme + locale). */}
        <div className="shrink-0">
          {AUTH_MODE === 'gitlab-sso' ? <AuthChip /> : <SidebarUserCard />}
        </div>
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
