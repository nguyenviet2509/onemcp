'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { IdentifyAsDropdown } from './identify-as-dropdown';
import { SpaceSwitcher } from './space-switcher';
import { SavedSearchesList } from './saved-searches-list';

// Main navigation header.
// SpaceSwitcher is client-only (useSearchParams) — already inside a Suspense boundary
// from layout.tsx, but we add an inner one here for safety.
export function Nav() {
  return (
    <header className="border-b border-secondary-200 bg-white dark:border-secondary-800 dark:bg-secondary-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Left: logo + nav links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">
            OneMCP
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-4 text-sm text-secondary-600 dark:text-secondary-400"
          >
            <Link href="/search" className="hover:text-secondary-900 dark:hover:text-secondary-100">
              Search
            </Link>
            <Link href="/skills" className="hover:text-secondary-900 dark:hover:text-secondary-100">
              Skills
            </Link>
            <Link href="/artifacts" className="hover:text-secondary-900 dark:hover:text-secondary-100">
              Artifacts
            </Link>
            <Link href="/profile" className="hover:text-secondary-900 dark:hover:text-secondary-100">
              Profile
            </Link>
          </nav>
        </div>

        {/* Right: space switcher + identity */}
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <SpaceSwitcher />
          </Suspense>
          <IdentifyAsDropdown />
        </div>
      </div>

      {/* Saved searches sidebar slot — rendered inline below nav on small screens,
          hidden on md+ (reserved for a future collapsible sidebar in 3D) */}
      {/* TODO(3D): move SavedSearchesList into a proper sidebar panel */}
      <div className="hidden">
        <SavedSearchesList />
      </div>
    </header>
  );
}
