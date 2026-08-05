import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { RoleCode } from '../users/entities/role.entity';

// Session payload persisted in Redis (JSON serialized).
// Access token from GitLab is intentionally NOT stored here.
export interface SessionPayload {
  userId: number;
  username: string;
  email: string | null;
  displayName: string | null;
  roles: RoleCode[];
  sessionId: string;
  createdAt: string; // ISO timestamp
  lastActivityAt: string; // ISO timestamp
}

// Opaque state blob stored per OAuth flow initiation.
export interface OAuthStatePayload {
  codeVerifier: string;
  returnTo: string;
  createdAt: string;
}

// Redis key namespaces — verified no clash with BullMQ (BullMQ uses bull:{queue}:* prefix).
const SESSION_PREFIX = 'session:';
const STATE_PREFIX = 'oauth_state:';

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly log = new Logger(SessionService.name);
  private redis!: Redis;
  private readonly sessionTtl: number;
  private readonly stateTtl: number;
  private readonly cookieName: string;

  constructor(private readonly config: ConfigService) {
    this.sessionTtl = this.config.get<number>('SESSION_TTL_SECONDS', 86400);
    this.stateTtl = this.config.get<number>('OAUTH_STATE_TTL_SECONDS', 300);
    this.cookieName = this.config.get<string>('SESSION_COOKIE_NAME', 'onemcp_session');
  }

  onModuleInit(): void {
    // Reuse same Redis connection params as BullMQ (shared REDIS_URL).
    // We create a separate ioredis client to avoid interfering with BullMQ's
    // internal blocking commands (BLPOP etc.) on its shared connection.
    const url = new URL(this.config.get<string>('REDIS_URL', 'redis://redis:6379'));
    this.redis = new Redis({
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      // Reconnect with exponential backoff — session ops are non-critical for boot.
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: false,
    });
    this.redis.on('error', (err: Error) => {
      this.log.error(`Redis session client error: ${err.message}`);
    });
    this.log.log(`SessionService initialized — sessionTtl=${this.sessionTtl}s stateTtl=${this.stateTtl}s`);
  }

  // Create a new session for an authenticated user. Returns opaque token.
  async createSession(payload: Omit<SessionPayload, 'sessionId' | 'createdAt' | 'lastActivityAt'>): Promise<string> {
    const token = randomUUID();
    const now = new Date().toISOString();
    const session: SessionPayload = {
      ...payload,
      sessionId: token,
      createdAt: now,
      lastActivityAt: now,
    };
    const key = SESSION_PREFIX + token;
    await this.redis.set(key, JSON.stringify(session), 'EX', this.sessionTtl);
    this.log.debug(`session_created userId=${payload.userId} username=${payload.username}`);
    return token;
  }

  // Retrieve session and slide TTL (extend expiry on each access).
  async getSession(token: string): Promise<SessionPayload | null> {
    const key = SESSION_PREFIX + token;
    const raw = await this.redis.get(key);
    if (!raw) return null;

    let session: SessionPayload;
    try {
      session = JSON.parse(raw) as SessionPayload;
    } catch {
      this.log.warn(`session_parse_error token=[redacted]`);
      await this.redis.del(key);
      return null;
    }

    // Sliding TTL — reset expiry on each access.
    const now = new Date().toISOString();
    session.lastActivityAt = now;
    await this.redis.set(key, JSON.stringify(session), 'EX', this.sessionTtl);

    return session;
  }

  // Revoke session immediately (logout).
  async revokeSession(token: string): Promise<void> {
    await this.redis.del(SESSION_PREFIX + token);
    this.log.debug(`session_revoked token=[redacted]`);
  }

  // Store OAuth state nonce + code_verifier for PKCE flow.
  // Returns the state nonce (UUID) to embed in the authorize URL.
  async createState(codeVerifier: string, returnTo: string): Promise<string> {
    const state = randomUUID();
    const payload: OAuthStatePayload = {
      codeVerifier,
      returnTo,
      createdAt: new Date().toISOString(),
    };
    const key = STATE_PREFIX + state;
    await this.redis.set(key, JSON.stringify(payload), 'EX', this.stateTtl);
    return state;
  }

  // Consume state nonce — DELETE on read to prevent replay attacks.
  // Returns null if state not found or expired.
  async consumeState(state: string): Promise<OAuthStatePayload | null> {
    const key = STATE_PREFIX + state;
    // Atomic GET+DEL: use pipeline to ensure consume-on-read.
    const pipeline = this.redis.pipeline();
    pipeline.get(key);
    pipeline.del(key);
    const results = await pipeline.exec();

    const raw = results?.[0]?.[1] as string | null;
    if (!raw) return null;

    try {
      return JSON.parse(raw) as OAuthStatePayload;
    } catch {
      this.log.warn(`oauth_state_parse_error state=[redacted]`);
      return null;
    }
  }

  get cookieNameValue(): string {
    return this.cookieName;
  }
}
