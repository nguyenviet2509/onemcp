// Client-side identity store for v1 trust-header mode.
// Sau khi auth-integration plan hoàn thành, module này thay bằng session cookie.
const KEY = 'onemcp.identity';

export function getIdentity(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setIdentity(username: string): void {
  if (typeof window === 'undefined') return;
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,32}$/.test(clean)) {
    throw new Error('Username invalid — chỉ a-z, 0-9, . _ - (2-32 chars)');
  }
  window.localStorage.setItem(KEY, clean);
}

export function clearIdentity(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
