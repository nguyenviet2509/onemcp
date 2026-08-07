import { getIdentity } from './identity';

// Auth mode env — set at build time.
// gitlab-sso: session cookie auth, no X-Onemcp-User header injection.
// trust-header (default): legacy localStorage identity → X-Onemcp-User header.
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE;

// Fetch wrapper — auto inject X-Onemcp-User header từ localStorage (trust-header mode only).
// SSO mode: credentials:'same-origin' sends cookie automatically, no header injection.
// Base URL relative (dùng nginx proxy /api/*).
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  // Only inject X-Onemcp-User in trust-header mode (legacy).
  // In gitlab-sso mode the session cookie handles identity — injecting this header
  // would confuse the backend session middleware.
  if (AUTH_MODE !== 'gitlab-sso') {
    const identity = getIdentity();
    if (identity) headers.set('X-Onemcp-User', identity);
  }
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Must check '/api/' with trailing slash — otherwise '/api-keys' matches
  // startsWith('/api') and skips the prefix, producing wrong URL '/api-keys'.
  const url = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as T;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
