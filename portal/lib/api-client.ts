// Fetch wrapper for OneMCP portal API calls.
// Base URL relative — nginx proxies /api/* to backend.
// Credentials: 'include' so oauth2-proxy session cookie travels with every request.
// X-Onemcp-User header is injected by nginx from oauth2-proxy $auth_username — do NOT
// send it from client-side (nginx overwrites it; client-injected value is noise).
// On 401: redirect to oauth2-proxy sign-in preserving current URL for post-login return.
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Must check '/api/' with trailing slash — otherwise '/api-keys' matches
  // startsWith('/api') and skips the prefix, producing wrong URL '/api-keys'.
  const url = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    // Session expired or not authenticated — redirect to oauth2-proxy sign-in.
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/oauth2/sign_in?rd=${returnUrl}`;
    // Return a never-resolving promise so callers don't receive a partial response.
    return new Promise<never>(() => {});
  }

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
