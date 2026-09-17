import { Injectable, Logger } from '@nestjs/common';
import { ToolBridge } from './entities/tool-bridge.entity';
import { ToolUpstream } from './entities/tool-upstream.entity';
import { readCapped, CappedRead } from './response-cap.stream';

export interface ProxyCallOpts {
  bridge: ToolBridge;
  upstream: ToolUpstream;
  bearer: string;
  args: Record<string, unknown>;
  username: string;
  zitadelSub: string;
  correlationId: string;
}

export interface ProxyResult extends CappedRead {
  status: number;
}

// Validate no path traversal or absolute URLs injected via args.
function assertArgSafe(val: string): void {
  if (/\.\./.test(val) || /^https?:\/\//i.test(val) || /^\/\//.test(val)) {
    throw new Error(`Unsafe arg value rejected: "${val.slice(0, 64)}"`);
  }
}

// Substitute :param placeholders in path from args; return remaining args.
function buildUrl(
  baseUrl: string,
  pathTemplate: string,
  method: string,
  args: Record<string, unknown>,
): { url: string; remaining: Record<string, unknown> } {
  const used = new Set<string>();

  const resolvedPath = pathTemplate.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name: string) => {
    if (!(name in args)) throw new Error(`Missing required path param: ${name}`);
    const val = String(args[name]);
    assertArgSafe(val);
    used.add(name);
    return encodeURIComponent(val);
  });

  const base = baseUrl.replace(/\/$/, '');
  const remaining: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (!used.has(k)) remaining[k] = v;
  }

  // GET: remaining → query string. POST/PUT/DELETE: remaining → body (returned separately).
  if (method === 'GET' && Object.keys(remaining).length > 0) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(remaining)) {
      qs.append(k, String(v));
    }
    return { url: `${base}${resolvedPath}?${qs.toString()}`, remaining: {} };
  }

  return { url: `${base}${resolvedPath}`, remaining };
}

// Whitelist-only headers — no injection from args.
function buildHeaders(opts: ProxyCallOpts): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${opts.bearer}`,
    'X-Onemcp-User': opts.username,
    'X-Onemcp-User-Sub': opts.zitadelSub,
    'X-Onemcp-Correlation-Id': opts.correlationId,
    'User-Agent': 'OneMCP-ToolBridge/1.0',
  };
  if (opts.bridge.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

const HARD_CAP_MS = 30_000;
const RETRY_DELAY_MS = 200;

@Injectable()
export class HttpProxyClient {
  private readonly log = new Logger(HttpProxyClient.name);

  async call(opts: ProxyCallOpts): Promise<ProxyResult> {
    const timeoutMs = Math.min(opts.upstream.timeoutMs ?? 10_000, HARD_CAP_MS);
    const { url, remaining } = buildUrl(
      opts.upstream.baseUrl,
      opts.bridge.path,
      opts.bridge.method,
      opts.args,
    );
    const headers = buildHeaders(opts);
    const body = opts.bridge.method !== 'GET' && Object.keys(remaining).length > 0
      ? JSON.stringify(remaining)
      : undefined;

    return this.fetchWithRetry(url, opts.bridge.method, headers, body, timeoutMs, opts.correlationId);
  }

  private async fetchWithRetry(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    timeoutMs: number,
    correlationId: string,
    attempt = 0,
  ): Promise<ProxyResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      // Retry only GET + 5xx, once, with 200ms backoff.
      if (method === 'GET' && res.status >= 500 && attempt === 0) {
        this.log.warn(`bridge retry correlationId=${correlationId} status=${res.status}`);
        await delay(RETRY_DELAY_MS);
        return this.fetchWithRetry(url, method, headers, body, timeoutMs, correlationId, 1);
      }

      const capped = await readCapped(res.body as ReadableStream<Uint8Array> | null);
      return { status: res.status, ...capped };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { status: 0, body: '[upstream_timeout]', truncated: false, bytesRead: 0 };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
