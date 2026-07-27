'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { IdentifyAsDropdown } from './identify-as-dropdown';
import { SpaceSwitcher } from './space-switcher';
import { SavedSearchesList } from './saved-searches-list';

// Legacy top nav — replaced by sidebar-nav in current layout. Kept for fallback.
// Option A tokens: border-border, bg-background, text-foreground/muted-foreground.
export function Nav() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-foreground">
            OneMCP
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/search"     className="hover:text-foreground transition-colors">Search</Link>
            <Link href="/skills"     className="hover:text-foreground transition-colors">Skills</Link>
            <Link href="/artifacts"  className="hover:text-foreground transition-colors">Artifacts</Link>
            <Link href="/spaces"     className="hover:text-foreground transition-colors">Spaces</Link>
            <Link href="/onboarding" className="hover:text-foreground transition-colors">Onboarding</Link>
            <Link href="/profile"    className="hover:text-foreground transition-colors">Profile</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}><SpaceSwitcher /></Suspense>
          <IdentifyAsDropdown />
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl">
          <SavedSearchesList />
        </div>
      </div>
    </header>
  );
}
