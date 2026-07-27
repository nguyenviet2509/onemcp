'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getIdentity } from '@/lib/identity';

// Version constant — update when bumping portal version
const PORTAL_VERSION = 'v1.5';

// Brand section at top of sidebar: logo, version, current identity.
// SSO not ready — reads identity from localStorage via getIdentity().
// When SSO ships, replace getIdentity() with session user email.
export function SidebarBrand() {
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  return (
    <div className="px-4 py-5 border-b border-slate-800">
      <Link
        href="/"
        className="block text-base font-semibold text-slate-100 hover:text-white transition-colors"
        aria-label="OneMCP home"
      >
        OneMCP
      </Link>
      <p className="mt-1 text-xs text-slate-500">
        {PORTAL_VERSION}
        {identity ? (
          <>
            {' · '}
            <span className="text-slate-400">{identity}</span>
          </>
        ) : (
          <>
            {' · '}
            <span className="text-slate-600 italic">— sign in</span>
          </>
        )}
      </p>
    </div>
  );
}
