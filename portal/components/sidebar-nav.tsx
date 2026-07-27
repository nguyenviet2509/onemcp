'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Search, Sparkles, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { listArtifacts } from '@/lib/api/artifacts';

// Exactly 5 nav icons — icon budget enforced here. ZERO icons elsewhere.
const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  showCount?: boolean;
}> = [
  { href: '/',                 label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/artifacts',        label: 'Artifacts',    icon: FileText },
  { href: '/search',           label: 'Search',       icon: Search },
  { href: '/skills',           label: 'Skills',       icon: Sparkles },
  { href: '/artifacts/review', label: 'Review queue', icon: ClipboardCheck, showCount: true },
];

// Primary sidebar navigation with active state + pending review count badge.
export function SidebarNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    listArtifacts({ status: 'pending' })
      .then((all) => setPendingCount(all.length))
      .catch(() => setPendingCount(null));
  }, []);

  return (
    <nav aria-label="Main navigation" className="px-2 py-3">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, showCount }) => {
          // Active: exact match for dashboard, prefix match for others
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {showCount && pendingCount !== null && pendingCount > 0 && (
                  <Badge variant="secondary" className="tabular-nums text-xs">
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
