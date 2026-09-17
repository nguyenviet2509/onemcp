/**
 * Unit tests for Phase 3 bridge proxy + dispatch:
 *  - response-cap.stream: 1MB cap, truncation marker
 *  - http-proxy.client: timeout → status 0, retry GET+5xx once, no retry POST+5xx, path param substitution
 *  - bridge-dispatcher.service: Path C block, required-field validation, success/error metrics
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { readCapped } from './response-cap.stream';
import { HttpProxyClient } from './http-proxy.client';
import { BridgeDispatcherService } from './bridge-dispatcher.service';
import { ToolUpstreamsService } from './tool-upstreams.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MetricsService } from '../metrics/metrics.service';
import { ParamSchemaValidator } from './param-schema.validator';
import { ToolBridge } from './entities/tool-bridge.entity';
import { ToolUpstream } from './entities/tool-upstream.entity';
import { RequestUser } from '../common/user-request';
import { Registry } from 'prom-client';
import { initHashSecret } from '../mcp/mcp-args-redactor';

// ─── readCapped ───────────────────────────────────────────────────────────────

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index++]));
    },
  });
}

describe('readCapped', () => {
  it('reads small body without truncation', async () => {
    const stream = makeStream(['hello', ' world']);
    const result = await readCapped(stream, 1_000_000);
    expect(result.body).toBe('hello world');
    expect(result.truncated).toBe(false);
    expect(result.bytesRead).toBe(11);
  });

  it('truncates at cap and appends marker', async () => {
    const big = 'A'.repeat(600_000);
    const stream = makeStream([big, big]); // 1.2 MB total
    const result = await readCapped(stream, 1_000_000);
    expect(result.truncated).toBe(true);
    expect(result.bytesRead).toBeLessThanOrEqual(1_000_000);
    expect(result.body).toContain('[...TRUNCATED');
  });

  it('returns empty string for null stream', async () => {
    const result = await readCapped(null);
    expect(result.body).toBe('');
    expect(result.truncated).toBe(false);
  });
});

// ─── HttpProxyClient ──────────────────────────────────────────────────────────

function makeUpstreamEntity(overrides: Partial<ToolUpstream> = {}): ToolUpstream {
  return {
    id: 'up-1',
    name: 'test',
    baseUrl: 'https://example.com',
    bearerCiphertext: '',
    timeoutMs: 10_000,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeBridge(overrides: Partial<ToolBridge> = {}): ToolBridge {
  return {
    id: 'br-1',
    upstreamId: 'up-1',
    upstream: makeUpstreamEntity(),
    name: 'test_tool',
    description: 'test',
    method: 'GET',
    path: '/api/devices',
    paramSchema: { type: 'object', properties: {} },
    permissionId: 'osh.read',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProxyOpts(bridge: ToolBridge, upstream: ToolUpstream, args: Record<string, unknown> = {}) {
  return {
    bridge,
    upstream,
    bearer: 'secret-token',
    args,
    username: 'alice',
    zitadelSub: 'sub-123',
    correlationId: 'corr-abc',
  };
}

describe('HttpProxyClient', () => {
  let client: HttpProxyClient;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    client = new HttpProxyClient();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns status 0 on AbortError (timeout)', async () => {
    fetchSpy.mockRejectedValue(Object.assign(new Error('abort'), { name: 'AbortError' }));
    const result = await client.call(makeProxyOpts(makeBridge(), makeUpstreamEntity({ timeoutMs: 1 })));
    expect(result.status).toBe(0);
    expect(result.body).toContain('upstream_timeout');
  });

  it('retries GET + 5xx exactly once then returns', async () => {
    const mockBody = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
    fetchSpy
      .mockResolvedValueOnce({ status: 503, body: mockBody } as Response)
      .mockResolvedValueOnce({ status: 200, body: new ReadableStream<Uint8Array>({ start(c) { c.close(); } }) } as Response);

    const result = await client.call(makeProxyOpts(makeBridge({ method: 'GET' }), makeUpstreamEntity()));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  it('does NOT retry POST + 5xx', async () => {
    const mockBody = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
    fetchSpy.mockResolvedValueOnce({ status: 500, body: mockBody } as Response);

    const result = await client.call(makeProxyOpts(makeBridge({ method: 'POST' }), makeUpstreamEntity(), { data: 'x' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(500);
  });

  it('substitutes path params from args', async () => {
    const mockBody = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
    fetchSpy.mockResolvedValueOnce({ status: 200, body: mockBody } as Response);

    const bridge = makeBridge({ path: '/api/devices/:id', method: 'GET' });
    await client.call(makeProxyOpts(bridge, makeUpstreamEntity(), { id: '42' }));

    const calledUrl = (fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl).toContain('/api/devices/42');
  });

  it('rejects path traversal in args', async () => {
    const bridge = makeBridge({ path: '/api/:path', method: 'GET' });
    await expect(
      client.call(makeProxyOpts(bridge, makeUpstreamEntity(), { path: '../secret' })),
    ).rejects.toThrow('Unsafe arg value');
  });

  it('forwards X-Onemcp-User-Sub header', async () => {
    const mockBody = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
    fetchSpy.mockResolvedValueOnce({ status: 200, body: mockBody } as Response);

    await client.call(makeProxyOpts(makeBridge(), makeUpstreamEntity()));

    const calledHeaders = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(calledHeaders['X-Onemcp-User-Sub']).toBe('sub-123');
  });
});

// ─── BridgeDispatcherService ──────────────────────────────────────────────────

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 1,
    username: 'alice',
    roles: ['contributor'],
    departmentId: 1,
    status: 'active',
    claimedFromHeader: true,
    zitadelSub: 'sub-abc',
    authPath: 'oauth',
    ...overrides,
  };
}

describe('BridgeDispatcherService', () => {
  let dispatcher: BridgeDispatcherService;
  let mockProxy: jest.Mocked<HttpProxyClient>;
  let mockUpstreams: jest.Mocked<Partial<ToolUpstreamsService>>;
  let mockAudit: jest.Mocked<Partial<AuditLogService>>;
  let mockMetrics: jest.Mocked<Partial<MetricsService>>;

  beforeAll(() => {
    // Initialize hash secret so redactArgs doesn't throw in test environment.
    initHashSecret('test-secret-for-unit-tests-minimum-32-chars!!');
  });

  beforeEach(async () => {
    const registry = new Registry();
    mockProxy = { call: jest.fn() } as unknown as jest.Mocked<HttpProxyClient>;
    mockUpstreams = {
      getDecryptedBearer: jest.fn().mockResolvedValue('bearer-token'),
      getEntity: jest.fn().mockResolvedValue(makeUpstreamEntity()),
    } as jest.Mocked<Partial<ToolUpstreamsService>>;
    mockAudit = { record: jest.fn() } as jest.Mocked<Partial<AuditLogService>>;
    mockMetrics = { registry } as jest.Mocked<Partial<MetricsService>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BridgeDispatcherService,
        { provide: HttpProxyClient, useValue: mockProxy },
        { provide: ToolUpstreamsService, useValue: mockUpstreams },
        { provide: AuditLogService, useValue: mockAudit },
        { provide: MetricsService, useValue: mockMetrics },
        ParamSchemaValidator,
      ],
    }).compile();

    dispatcher = module.get(BridgeDispatcherService);
    dispatcher.onModuleInit();
  });

  it('throws ForbiddenException for header-path user (Path C block)', async () => {
    const user = makeUser({ authPath: 'header', zitadelSub: undefined });
    const bridge = makeBridge();
    await expect(dispatcher.dispatch(bridge, {}, user)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when zitadelSub missing (oauth path without sub)', async () => {
    const user = makeUser({ authPath: 'oauth', zitadelSub: undefined });
    await expect(dispatcher.dispatch(makeBridge(), {}, user)).rejects.toThrow(ForbiddenException);
  });

  it('returns errorResult for missing required param', async () => {
    const bridge = makeBridge({
      paramSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    });
    const result = await dispatcher.dispatch(bridge, {}, makeUser());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Missing required argument: id');
  });

  it('dispatches successful call and returns body', async () => {
    mockProxy.call.mockResolvedValue({ status: 200, body: '{"ok":true}', truncated: false, bytesRead: 12 });
    const result = await dispatcher.dispatch(makeBridge(), {}, makeUser());
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe('{"ok":true}');
  });

  it('marks isError=true when upstream returns 403', async () => {
    mockProxy.call.mockResolvedValue({ status: 403, body: 'forbidden', truncated: false, bytesRead: 9 });
    const result = await dispatcher.dispatch(makeBridge(), {}, makeUser());
    expect(result.isError).toBe(true);
  });

  it('publishes audit record on success', async () => {
    mockProxy.call.mockResolvedValue({ status: 200, body: 'ok', truncated: false, bytesRead: 2 });
    await dispatcher.dispatch(makeBridge(), {}, makeUser());
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mcp.tool.call' }),
    );
  });
});
