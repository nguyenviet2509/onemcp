import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Redis-backed opaque token store for OAuth 2.1 AS.
// Namespace: `oauth:{kind}:{token}` — kinds: code, access, refresh.
// TTL enforced by Redis EX — expired keys disappear, no cleanup job needed.

export interface AuthorizationCodePayload {
  clientId: string;
  userId: number;
  username: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopes: string[];
  state?: string;
}

export interface AccessTokenPayload {
  clientId: string;
  userId: number;
  username: string;
  scopes: string[];
  expiresAt: number;
}

export interface RefreshTokenPayload {
  clientId: string;
  userId: number;
  username: string;
  scopes: string[];
}

@Injectable()
export class OAuthTokenStore implements OnModuleDestroy {
  private readonly log = new Logger(OAuthTokenStore.name);
  private readonly client: Redis;
  private static readonly CODE_TTL = 60;              // 1 min
  private static readonly ACCESS_TTL = 60 * 60;       // 1h
  private static readonly REFRESH_TTL = 60 * 60 * 24 * 30; // 30d

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL', 'redis://redis:6379');
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.client.on('error', (e) => this.log.error(`redis error: ${e.message}`));
  }

  onModuleDestroy(): void {
    void this.client.quit().catch(() => {});
  }

  private key(kind: 'code' | 'access' | 'refresh', token: string): string {
    return `oauth:${kind}:${token}`;
  }

  async saveCode(code: string, payload: AuthorizationCodePayload): Promise<void> {
    await this.client.set(this.key('code', code), JSON.stringify(payload), 'EX', OAuthTokenStore.CODE_TTL);
  }

  async consumeCode(code: string): Promise<AuthorizationCodePayload | null> {
    const k = this.key('code', code);
    // GETDEL atomic (Redis 6.2+); fallback to MULTI if unsupported.
    const raw = await this.client.getdel(k).catch(async () => {
      const multi = this.client.multi();
      multi.get(k);
      multi.del(k);
      const res = await multi.exec();
      return (res?.[0]?.[1] as string | null) ?? null;
    });
    return raw ? (JSON.parse(raw) as AuthorizationCodePayload) : null;
  }

  async saveAccess(token: string, payload: AccessTokenPayload): Promise<void> {
    await this.client.set(this.key('access', token), JSON.stringify(payload), 'EX', OAuthTokenStore.ACCESS_TTL);
  }

  async getAccess(token: string): Promise<AccessTokenPayload | null> {
    const raw = await this.client.get(this.key('access', token));
    return raw ? (JSON.parse(raw) as AccessTokenPayload) : null;
  }

  async revokeAccess(token: string): Promise<void> {
    await this.client.del(this.key('access', token));
  }

  async saveRefresh(token: string, payload: RefreshTokenPayload): Promise<void> {
    await this.client.set(this.key('refresh', token), JSON.stringify(payload), 'EX', OAuthTokenStore.REFRESH_TTL);
  }

  async consumeRefresh(token: string): Promise<RefreshTokenPayload | null> {
    const k = this.key('refresh', token);
    const raw = await this.client.getdel(k).catch(async () => {
      const multi = this.client.multi();
      multi.get(k);
      multi.del(k);
      const res = await multi.exec();
      return (res?.[0]?.[1] as string | null) ?? null;
    });
    return raw ? (JSON.parse(raw) as RefreshTokenPayload) : null;
  }

  async revokeRefresh(token: string): Promise<void> {
    await this.client.del(this.key('refresh', token));
  }
}
