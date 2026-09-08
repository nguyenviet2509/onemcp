'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, FileText, Search, Wrench, ClipboardCheck, Boxes, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { listArtifacts } from '@/lib/api/artifacts';

interface MeMinimal { roles?: string[] }

// Primary nav — icons: lucide, size-3.5, stroke-width 1.5 (modern minimal).
// Wrench for Skills = MCP tools/utilities (semantic fit; replaces Sparkles decor).
// Shield for Audit = dept-admin-only per-call log viewer (plan 260908-1552 phase 07).
const NAV_ITEMS: Array<{
  href: string;
  key: 'dashboard' | 'artifacts' | 'search' | 'skills' | 'review' | 'projects' | 'audit';
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  showCount?: boolean;
  adminOnly?: boolean;
}> = [
  { href: '/',                 key: 'dashboard', icon: LayoutDashboard },
  { href: '/artifacts',        key: 'artifacts', icon: FileText },
  { href: '/search',           key: 'search',    icon: Search },
  { href: '/skills',           key: 'skills',    icon: Wrench },
  { href: '/projects',         key: 'projects',  icon: Boxes },
  { href: '/artifacts/review', key: 'review',    icon: ClipboardCheck, showCount: true },
  { href: '/audit',            key: 'audit',     icon: Shield, adminOnly: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const t = useTranslations('nav');

  useEffect(() => {
    listArtifacts({ status: 'pending' })
      .then((all) => setPendingCount(all.length))
      .catch(() => setPendingCount(null));
    // Role gate — hide Audit item from non-admins. Server side also enforces
    // via requireAdmin() in AuditController (defense-in-depth).
    apiFetch<MeMinimal>('/me')
      .then((me) => {
        setIsAdmin(
          me?.roles?.some((r) => r === 'super-admin' || r === 'dept-admin') ?? false,
        );
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const visibleItems = NAV_ITEMS.filter((it) => !it.adminOnly || isAdmin);

  return (
    <nav aria-label="Main navigation" className="px-2 pb-1 pt-1">
      <ul className="space-y-px">
        {visibleItems.map(({ href, key, icon: Icon, showCount }) => {
          const label = t(key);
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'font-normal text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={[
                    'size-3.5 shrink-0 transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                  ].join(' ')}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="flex-1 truncate">{label}</span>
                {showCount && pendingCount !== null && pendingCount > 0 && (
                  <Badge variant="secondary" className="tabular-nums px-1.5">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
