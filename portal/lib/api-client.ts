// Fetch wrapper for OneMCP portal API calls.
// Base URL relative — nginx proxies /api/* to backend.
// Credentials: 'include' so oauth2-proxy session cookie travels with every request.
// X-Onemcp-User header is injected by nginx from oauth2-proxy $auth_username — do NOT
// send it from client-side (nginx overwrites it; client-injected value is noise).
// On 401: redirect to oauth2-proxy sign-in preserving current URL for post-login return.
//
// OIDC mode (AUTH_MODE=oidc, plan 260819-1628 phase-03): tự động thêm
// `Authorization: Bearer <accessToken>` từ NextAuth session. Backend
// ZitadelJwtMiddleware verify JWT → set req.user (Cơ chế 2). Trong IAP mode
// (default), session fetch trả null → skip Bearer, IAP header path work.

// Cache session cho request cùng page — tránh N calls tới /api/auth/session.
let sessionCache: { at: number; token: string | null } | null = null;
const SESSION_CACHE_TTL_MS = 30_000;

// Exported — dùng chung cho multipart upload / blob download (không đi qua apiFetch).
export async function getAccessToken(): Promise<string | null> {
  // Chỉ chạy client-side. Server component có `auth()` dùng riêng.
  if (typeof window === 'undefined') return null;
  const now = Date.now();
  if (sessionCache && now - sessionCache.at < SESSION_CACHE_TTL_MS) return sessionCache.token;
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) {
      sessionCache = { at: now, token: null };
      return null;
    }
    const data = (await res.json()) as { accessToken?: string } | null;
    const token = data?.accessToken ?? null;
    sessionCache = { at: now, token };
    return token;
  } catch {
    sessionCache = { at: now, token: null };
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  // OIDC mode: forward accessToken. IAP mode: getAccessToken() trả null → skip.
  if (!headers.has('Authorization')) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  // Must check '/api/' with trailing slash — otherwise '/api-keys' matches
  // startsWith('/api') and skips the prefix, producing wrong URL '/api-keys'.
  const url = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    // Session expired or not authenticated. OIDC mode → NextAuth signin.
    // IAP mode → oauth2-proxy sign-in (legacy path).
    const returnUrl = encodeURIComponent(window.location.href);
    const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'iap';
    // OIDC: dùng custom /auth/signin (auto-trigger Zitadel, skip provider button).
    const signInPath =
      authMode === 'oidc'
        ? `/auth/signin?callbackUrl=${returnUrl}`
        : `/oauth2/sign_in?rd=${returnUrl}`;
    window.location.href = signInPath;
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
