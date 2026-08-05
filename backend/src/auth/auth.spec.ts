import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { CookieAuthMiddleware } from './cookie-auth.middleware';
import { GitlabOAuthService } from './gitlab-oauth.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfigService(overrides: Record<string, string | number> = {}): ConfigService {
  const defaults: Record<string, string | number> = {
    REDIS_URL: 'redis://localhost:6379',
    SESSION_COOKIE_NAME: 'onemcp_session',
    SESSION_TTL_SECONDS: 86400,
    OAUTH_STATE_TTL_SECONDS: 300,
    GITLAB_SSO_BASE_URL: 'https://gitlab.inet.vn',
    GITLAB_OAUTH_APP_ID: 'test-app-id',
    GITLAB_OAUTH_APP_SECRET: 'test-secret',
    GITLAB_OAUTH_REDIRECT_URI: 'https://202.92.5.113/api/auth/gitlab/callback',
    ...overrides,
  };
  return {
    get: jest.fn(<T>(key: string, fallback?: T): T => (defaults[key] ?? fallback) as T),
  } as unknown as ConfigService;
}

// Minimal Redis mock — pipeline returns [get-result, del-result].
function makeRedisMock(store: Map<string, string>) {
  return {
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    del: jest.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    pipeline: jest.fn(() => {
      let pendingGet: string | null = null;
      return {
        get: jest.fn((key: string) => {
          pendingGet = key;
          return undefined;
        }),
        del: jest.fn(),
        exec: jest.fn(async () => {
          const val = pendingGet ? (store.get(pendingGet) ?? null) : null;
          if (pendingGet) store.delete(pendingGet); // simulate DEL
          return [[null, val], [null, 1]];
        }),
      };
    }),
    on: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// SessionService tests
// ---------------------------------------------------------------------------

describe('SessionService', () => {
  let service: SessionService;
  let store: Map<string, string>;

  beforeEach(async () => {
    store = new Map();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: ConfigService, useValue: makeConfigService() },
      ],
    }).compile();

    service = module.get(SessionService);
    // Inject mock redis bypassing onModuleInit.
    (service as unknown as { redis: ReturnType<typeof makeRedisMock> }).redis = makeRedisMock(store);
  });

  describe('createSession / getSession — sliding TTL', () => {
    it('should create a session and retrieve it', async () => {
      const token = await service.createSession({
        userId: 1,
        username: 'alice',
        email: 'alice@inet.vn',
        displayName: 'Alice',
        roles: ['contributor'],
      });
      expect(token).toMatch(/^[0-9a-f-]{36}$/); // UUID format

      const session = await service.getSession(token);
      expect(session).not.toBeNull();
      expect(session!.username).toBe('alice');
      expect(session!.userId).toBe(1);
    });

    it('sliding TTL: getSession updates lastActivityAt on each call', async () => {
      const token = await service.createSession({
        userId: 2,
        username: 'bob',
        email: 'bob@inet.vn',
        displayName: 'Bob',
        roles: ['contributor'],
      });

      const first = await service.getSession(token);
      // Small delay to ensure timestamp differs.
      await new Promise((r) => setTimeout(r, 5));
      const second = await service.getSession(token);

      expect(first!.lastActivityAt).not.toBe(second!.lastActivityAt);
    });

    it('returns null for unknown token', async () => {
      const result = await service.getSession('non-existent-token');
      expect(result).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('should remove session from store', async () => {
      const token = await service.createSession({
        userId: 3,
        username: 'carol',
        email: 'carol@inet.vn',
        displayName: 'Carol',
        roles: ['contributor'],
      });

      await service.revokeSession(token);
      const result = await service.getSession(token);
      expect(result).toBeNull();
    });
  });

  describe('createState / consumeState — consume-on-verify', () => {
    it('should store and return state payload on first consume', async () => {
      const state = await service.createState('verifier123', '/dashboard');
      const payload = await service.consumeState(state);

      expect(payload).not.toBeNull();
      expect(payload!.codeVerifier).toBe('verifier123');
      expect(payload!.returnTo).toBe('/dashboard');
    });

    it('should return null on second consume (DEL after first read)', async () => {
      const state = await service.createState('verifier456', '/');
      await service.consumeState(state); // first consume
      const replay = await service.consumeState(state); // replay attempt

      expect(replay).toBeNull();
    });

    it('should return null for unknown state', async () => {
      const result = await service.consumeState('unknown-uuid');
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// CookieAuthMiddleware tests
// ---------------------------------------------------------------------------

describe('CookieAuthMiddleware', () => {
  let middleware: CookieAuthMiddleware;
  let sessionService: jest.Mocked<SessionService>;

  beforeEach(() => {
    sessionService = {
      getSession: jest.fn(),
      cookieNameValue: 'onemcp_session',
    } as unknown as jest.Mocked<SessionService>;

    middleware = new CookieAuthMiddleware(sessionService);
  });

  function makeReq(cookieHeader?: string, existingUser?: object) {
    return {
      headers: { cookie: cookieHeader },
      user: existingUser,
    } as unknown as import('../common/user-request').AuthedRequest;
  }

  it('falls through (next) when no cookie present', async () => {
    const req = makeReq(undefined);
    const next = jest.fn();
    await middleware.use(req, {} as import('express').Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });

  it('falls through when cookie present but session not found in Redis', async () => {
    sessionService.getSession.mockResolvedValue(null);
    const req = makeReq('onemcp_session=abc123');
    const next = jest.fn();
    await middleware.use(req, {} as import('express').Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });

  it('sets req.user when valid session found', async () => {
    sessionService.getSession.mockResolvedValue({
      userId: 10,
      username: 'diana',
      email: 'diana@inet.vn',
      displayName: 'Diana',
      roles: ['super-admin'],
      sessionId: 'session-uuid-123',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    });

    const req = makeReq('onemcp_session=valid-token');
    const next = jest.fn();
    await middleware.use(req, {} as import('express').Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({
      id: 10,
      username: 'diana',
      roles: ['super-admin'],
      sessionId: 'session-uuid-123',
    });
  });

  it('skips cookie lookup when req.user already set (ApiKey path)', async () => {
    const req = makeReq('onemcp_session=token', { id: 5, username: 'eve' });
    const next = jest.fn();
    await middleware.use(req, {} as import('express').Response, next);
    expect(sessionService.getSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls through without throwing when Redis errors', async () => {
    sessionService.getSession.mockRejectedValue(new Error('Redis connection refused'));
    const req = makeReq('onemcp_session=token');
    const next = jest.fn();
    await middleware.use(req, {} as import('express').Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GitlabOAuthService — PKCE utility tests
// ---------------------------------------------------------------------------

describe('GitlabOAuthService — PKCE', () => {
  let service: GitlabOAuthService;

  beforeEach(() => {
    service = new GitlabOAuthService(makeConfigService());
  });

  it('generateCodeVerifier returns base64url string ≥43 chars', () => {
    const verifier = service.generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    // Base64URL charset: A-Z a-z 0-9 - _
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('deriveCodeChallenge produces S256 (SHA256 base64url) of verifier', () => {
    const { createHash } = require('crypto') as typeof import('crypto');
    const verifier = 'dGhpcyBpcyBhIHRlc3QgdmVyaWZpZXI';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(service.deriveCodeChallenge(verifier)).toBe(expected);
  });

  it('buildAuthorizeUrl contains required OAuth2 + PKCE params', () => {
    const url = new URL(service.buildAuthorizeUrl('state-uuid', 'challenge-value'));
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('read_user');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('state')).toBe('state-uuid');
    expect(url.searchParams.get('client_id')).toBe('test-app-id');
  });
});

// ---------------------------------------------------------------------------
// AUTH_MODE chain fallthrough test (TrustUserMiddleware behavior)
// ---------------------------------------------------------------------------

describe('TrustUserMiddleware — AUTH_MODE fallthrough', () => {
  it('falls through (next) in gitlab-sso mode when no identity header', async () => {
    // Dynamically import to allow jest.mock on ConfigService per test.
    const { TrustUserMiddleware } = await import('../access/trust-user.middleware');

    const configService = makeConfigService({ AUTH_MODE: 'gitlab-sso' });
    const usersService = { upsertByUsername: jest.fn() } as unknown as import('../users/users.service').UsersService;
    const rolesService = { rolesFor: jest.fn() } as unknown as import('../access/role-assigner.service').RoleAssignerService;

    const mw = new TrustUserMiddleware(configService, usersService, rolesService);

    const req = {
      originalUrl: '/api/spaces',
      headers: {},
      user: undefined,
      ip: '1.2.3.4',
      socket: { remoteAddress: '1.2.3.4' },
    } as unknown as import('../common/user-request').AuthedRequest;

    const next = jest.fn();
    await mw.use(req, {} as import('express').Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    // Should NOT call upsertByUsername since it fell through.
    expect(usersService.upsertByUsername).not.toHaveBeenCalled();
  });

  it('throws BadRequestException in trust-header mode when no identity header', async () => {
    const { TrustUserMiddleware } = await import('../access/trust-user.middleware');
    const { BadRequestException } = await import('@nestjs/common');

    const configService = makeConfigService({ AUTH_MODE: 'trust-header' });
    const usersService = { upsertByUsername: jest.fn() } as unknown as import('../users/users.service').UsersService;
    const rolesService = { rolesFor: jest.fn() } as unknown as import('../access/role-assigner.service').RoleAssignerService;

    const mw = new TrustUserMiddleware(configService, usersService, rolesService);

    const req = {
      originalUrl: '/api/spaces',
      headers: {},
      user: undefined,
      ip: '1.2.3.4',
      socket: { remoteAddress: '1.2.3.4' },
    } as unknown as import('../common/user-request').AuthedRequest;

    await expect(mw.use(req, {} as import('express').Response, jest.fn())).rejects.toThrow(BadRequestException);
  });
});
