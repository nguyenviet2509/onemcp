'use client';

import { useEffect, useState } from 'react';

// Shape of /api/auth/me response — MUST match backend AuthController.me return.
export interface CurrentUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
  status: 'active' | 'disabled';
}

// Fetch /api/auth/me once on mount. On 401 in SSO mode, hard-redirect to /login
// so stale-cookie users don't get stuck seeing a broken UI.
// Skip on /login itself to prevent redirect loop.
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/login') return;

    const ssoMode = process.env.NEXT_PUBLIC_AUTH_MODE === 'gitlab-sso';
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => {
        if (res.status === 401 && ssoMode) {
          // Stale/missing session in SSO mode — redirect to login with returnTo.
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?returnTo=${returnTo}`;
          return null;
        }
        if (!res.ok) return null;
        return res.json() as Promise<CurrentUser>;
      })
      .then((data) => {
        if (!cancelled && data) setUser(data);
      })
      .catch(() => {
        // Network error — leave user null, don't redirect (avoid loops on backend outage).
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
