// Client-side identity store for v1 trust-header mode.
// @deprecated — use session cookie (onemcp_session) in gitlab-sso mode.
// Exports preserved so existing imports (identify-as-dropdown, sidebar-user-card) compile.
// In gitlab-sso mode: setIdentity / clearIdentity are no-ops; getIdentity returns null.
const KEY = 'onemcp.identity';
const IS_SSO = process.env.NEXT_PUBLIC_AUTH_MODE === 'gitlab-sso';

export function getIdentity(): string | null {
  if (IS_SSO) return null;
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setIdentity(username: string): void {
  if (IS_SSO) return; // no-op in SSO mode
  if (typeof window === 'undefined') return;
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,32}$/.test(clean)) {
    throw new Error('Username invalid — chỉ a-z, 0-9, . _ - (2-32 chars)');
  }
  window.localStorage.setItem(KEY, clean);
}

export function clearIdentity(): void {
  if (IS_SSO) return; // no-op in SSO mode
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
