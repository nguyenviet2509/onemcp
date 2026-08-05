// Fetch wrapper — cookie auth only (credentials:'same-origin' sends onemcp_session automatically).
// Legacy X-Onemcp-User header injection removed — portal is SSO-only.
// Base URL relative (nginx proxy /api/*).
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
