'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Secondary nav items — text-only, no icons (icon budget: 0 outside sidebar-nav)
const SECONDARY_ITEMS = [
  { href: '/profile',          label: 'Profile' },
  { href: '/profile/api-keys', label: 'API keys' },
  { href: '/spaces',           label: 'Spaces' },
  { href: '/onboarding',       label: 'Onboarding' },
] as const;

// Secondary sidebar nav — profile, admin, onboarding links.
// Text-only. No icons (enforces icon budget ≤5 site-wide in sidebar-nav).
export function SidebarSecondaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secondary navigation" className="px-2 pb-4">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Account
      </p>
      <ul className="space-y-0.5">
        {SECONDARY_ITEMS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  'block rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
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
