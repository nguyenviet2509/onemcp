'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Key, LayoutGrid, Rocket, User } from 'lucide-react';
import type React from 'react';

// Icon budget extended for Account section — matches primary nav size-3.5 / stroke-width 1.75.
const SECONDARY_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}> = [
  { href: '/profile',          label: 'Profile',     icon: User },
  { href: '/profile/api-keys', label: 'API keys',    icon: Key },
  { href: '/spaces',           label: 'Spaces',      icon: LayoutGrid },
  { href: '/onboarding',       label: 'Onboarding',  icon: Rocket },
];

export function SidebarSecondaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secondary navigation" className="px-2 pb-2">
      <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Account
      </p>
      <ul className="space-y-px">
        {SECONDARY_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
