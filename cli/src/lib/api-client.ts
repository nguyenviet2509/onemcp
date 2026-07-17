/**
 * api-client.ts — HTTP fetch wrapper for OneMCP REST API.
 * - Base URL from env/config
 * - Timeout: 10 seconds
 * - TLS: verify by default; --insecure or ONEMCP_INSECURE=1 disables with loud warning
 * - Auth: X-Onemcp-User on ALL requests; Authorization: Bearer on POST/PUT/DELETE
 * - RT-4: tlsVerify default TRUE; warn loudly when disabled
 */

import { OnemcpConfig } from './config-store';

// undici Agent for TLS-skip dispatcher (Node 18+ fetch backend).
// Loaded lazily inside constructor to avoid hard dep at module top.
type UndiciAgent = { dispatch: unknown };

const REQUEST_TIMEOUT_MS = 10_000;

// HTTP methods that require Authorization: Bearer header
const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export interface ApiError {
  status: number;
  message: string;
  body?: unknown;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly user: string;
  private readonly token: string | undefined;
  private readonly tlsVerify: boolean;
  // undici Agent for TLS-skip dispatcher (RT-4 / H2 fix).
  // We do NOT mutate process.env.NODE_TLS_REJECT_UNAUTHORIZED — that leaks to other requests.
  private insecureDispatcher: UndiciAgent | null = null;

  constructor(config: OnemcpConfig) {
    // Strip trailing slash
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.user = config.user;
    this.token = config.token;
    this.tlsVerify = config.tlsVerify;

    // Warn loudly if TLS verification is disabled (RT-4)
    if (!this.tlsVerify) {
      process.stderr.write(
        '\n[WARNING] TLS verification is DISABLED (ONEMCP_INSECURE=1 or --insecure).\n' +
          '          Do NOT use this in production. Credentials may be exposed.\n\n',
      );
      // Build undici dispatcher once. Native `undici` module ships with Node 18+.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const undici = require('undici') as {
          Agent: new (opts: { connect: { rejectUnauthorized: boolean } }) => UndiciAgent;
        };
        this.insecureDispatcher = new undici.Agent({ connect: { rejectUnauthorized: false } });
      } catch (err) {
        process.stderr.write(
          `[WARNING] Could not load undici for TLS bypass: ${(err as Error).message}\n`,
        );
      }
    }
  }

  /** GET request — returns parsed JSON. */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path, undefined);
  }

  /** POST request — sends JSON body, requires token for auth. */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // X-Onemcp-User on ALL requests (trust header read by backend middleware)
      'X-Onemcp-User': this.user,
    };

    // Authorization: Bearer only on write operations (RT-4)
    if (WRITE_METHODS.has(method.toUpperCase())) {
      if (!this.token) {
        throw new Error(
          'Token required for write operations. Set ONEMCP_TOKEN env or add "token" field to ~/.onemcp/config.json',
        );
      }
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    // Apply undici dispatcher for TLS-skip when disabled (H2 fix).
    // No process.env mutation → other fetch calls in same process retain verification.
    if (!this.tlsVerify && url.startsWith('https://') && this.insecureDispatcher) {
      (fetchOptions as Record<string, unknown>)['dispatcher'] = this.insecureDispatcher;
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      if (msg.includes('abort') || msg.includes('timeout')) {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
      }
      throw new Error(`Network error: ${msg}`);
    }

    // Parse response body
    let responseBody: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    try {
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      const apiErr: ApiError = {
        status: response.status,
        message: extractMessage(responseBody, response.status),
        body: responseBody,
      };
      throw apiErr;
    }

    return responseBody as T;
  }
}

/** Check if thrown error is an ApiError shape. */
export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    'message' in err &&
    typeof (err as ApiError).status === 'number'
  );
}

/** Format API error for CLI output. */
export function formatApiError(err: ApiError): string {
  const statusLabels: Record<number, string> = {
    401: 'Unauthorized — check your token/user config',
    403: 'Forbidden — insufficient permissions',
    404: 'Not found',
    409: 'Conflict',
    422: 'Validation error',
    429: 'Rate limited — slow down',
    500: 'Server error',
    503: 'Server unavailable',
  };
  const label = statusLabels[err.status] ?? `HTTP ${err.status}`;
  return `[${label}] ${err.message}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractMessage(body: unknown, status: number): string {
  if (typeof body === 'string' && body.length > 0) return body.slice(0, 200);
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b['message'] === 'string') return b['message'];
    if (typeof b['error'] === 'string') return b['error'];
  }
  return `HTTP ${status}`;
}
