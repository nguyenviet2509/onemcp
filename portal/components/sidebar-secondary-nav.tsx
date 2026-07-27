'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Secondary nav — text-only. Matches primary nav padding/typography for
// visual consistency; only difference is no icon column (aligns with the
// site-wide icon budget of 5, all consumed by sidebar-nav).
const SECONDARY_ITEMS = [
  { href: '/profile',          label: 'Profile' },
  { href: '/profile/api-keys', label: 'API keys' },
  { href: '/spaces',           label: 'Spaces' },
  { href: '/onboarding',       label: 'Onboarding' },
] as const;

export function SidebarSecondaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secondary navigation" className="px-2 pb-2">
      <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Account
      </p>
      <ul className="space-y-px">
        {SECONDARY_ITEMS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  // Left-padded to align with primary-nav labels (icon column is 3.5 + gap 2.5 ≈ 24px)
                  'block rounded-md pl-[34px] pr-2.5 py-1.5 text-[13px] transition-colors',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'font-normal text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
