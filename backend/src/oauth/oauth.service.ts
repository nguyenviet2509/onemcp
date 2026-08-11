import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';
import { Repository } from 'typeorm';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthConsent } from './entities/oauth-consent.entity';
import { verifyPkce } from './pkce.util';
import { OAuthTokenStore } from './token-store.service';

// OAuth 2.1 Authorization Server — public API for AI Connector clients.
// Identity source: existing session (X-Onemcp-User via oauth2-proxy + Zitadel).
// Token issuance: opaque 32-byte URL-safe base64 (Redis-backed, revoke instant).
// PKCE mandatory (S256).

const ACCESS_TTL_SEC = 60 * 60;             // 1h (matched to token store)
const DEFAULT_SCOPES = ['mcp'];

export interface RegisterClientDto {
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method?: 'none' | 'client_secret_basic' | 'client_secret_post';
  scope?: string; // space-separated per RFC 6749
}

export interface RegisterClientResponse {
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  scope: string;
}

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
  state?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@Injectable()
export class OAuthService {
  private readonly log = new Logger(OAuthService.name);

  constructor(
    @InjectRepository(OAuthClient) private readonly clients: Repository<OAuthClient>,
    @InjectRepository(OAuthConsent) private readonly consents: Repository<OAuthConsent>,
    private readonly store: OAuthTokenStore,
  ) {}

  // --- Client registration (RFC 7591 DCR) ---
  async registerClient(dto: RegisterClientDto, createdByUserId?: number): Promise<RegisterClientResponse> {
    if (!dto.client_name || dto.client_name.length < 2) {
      throw new BadRequestException('client_name required (>= 2 chars)');
    }
    if (!Array.isArray(dto.redirect_uris) || dto.redirect_uris.length === 0) {
      throw new BadRequestException('redirect_uris required (non-empty array)');
    }
    for (const uri of dto.redirect_uris) {
      if (!/^https?:\/\/.+/.test(uri)) {
        throw new BadRequestException(`invalid redirect_uri: ${uri}`);
      }
    }

    const authMethod = dto.token_endpoint_auth_method ?? 'none';
    const scopes = dto.scope ? dto.scope.split(/\s+/).filter(Boolean) : DEFAULT_SCOPES;

    // DCR dedup for public clients — mcp-remote and similar can race and register twice within ms.
    // When client_name + sorted redirect_uris match an existing PKCE-only client < 60s old, reuse it.
    // Avoids race where authorize/token endpoints see different client_ids from same OAuth flow.
    if (authMethod === 'none') {
      const cutoff = new Date(Date.now() - 60_000);
      const candidates = await this.clients
        .createQueryBuilder('c')
        .where('c.name = :name', { name: dto.client_name.slice(0, 200) })
        .andWhere('c.token_endpoint_auth_method = :m', { m: 'none' })
        .andWhere('c.created_at > :cutoff', { cutoff })
        .getMany();
      const sortedInput = [...dto.redirect_uris].sort().join('|');
      const existing = candidates.find(
        (c) => [...c.redirectUris].sort().join('|') === sortedInput,
      );
      if (existing) {
        this.log.log(`DCR dedup reuse client_id=${existing.clientId} name="${dto.client_name}"`);
        return {
          client_id: existing.clientId,
          client_name: existing.name,
          redirect_uris: existing.redirectUris,
          token_endpoint_auth_method: existing.tokenEndpointAuthMethod,
          scope: existing.scopes.join(' '),
        };
      }
    }

    const clientId = nanoid(24);
    let secretPlain: string | undefined;
    let secretHash: string | null = null;
    if (authMethod !== 'none') {
      secretPlain = randomBytes(32).toString('base64url');
      secretHash = await bcrypt.hash(secretPlain, 10);
    }

    await this.clients.save(
      this.clients.create({
        clientId,
        clientSecretHash: secretHash,
        name: dto.client_name.slice(0, 200),
        redirectUris: dto.redirect_uris,
        scopes,
        tokenEndpointAuthMethod: authMethod,
        createdByUserId: createdByUserId ?? null,
      }),
    );
    this.log.log(`DCR client_id=${clientId} name="${dto.client_name}" auth=${authMethod}`);

    return {
      client_id: clientId,
      client_secret: secretPlain,
      client_name: dto.client_name,
      redirect_uris: dto.redirect_uris,
      token_endpoint_auth_method: authMethod,
      scope: scopes.join(' '),
    };
  }

  async getClient(clientId: string): Promise<OAuthClient> {
    const c = await this.clients.findOne({ where: { clientId } });
    if (!c) throw new NotFoundException('client not found');
    return c;
  }

  // --- Authorize (called from GET /oauth/authorize handler) ---
  // Returns either 'consent-required' or an auto-issued authorization code.
  async prepareAuthorization(params: AuthorizeParams, userId: number, username: string):
    Promise<{ action: 'consent-required'; client: OAuthClient; requestedScopes: string[] } | { action: 'auto-code'; code: string }> {
    if (params.codeChallengeMethod !== 'S256') {
      throw new BadRequestException('code_challenge_method must be S256');
    }
    if (!params.codeChallenge || params.codeChallenge.length < 43) {
      throw new BadRequestException('code_challenge required (S256, 43+ chars)');
    }

    const client = await this.getClient(params.clientId);
    if (!client.redirectUris.includes(params.redirectUri)) {
      throw new BadRequestException('redirect_uri not registered');
    }

    const requested = params.scope ? params.scope.split(/\s+/).filter(Boolean) : client.scopes;
    // Constrain to registered scopes.
    const scopes = requested.filter((s) => client.scopes.includes(s));
    if (scopes.length === 0) {
      throw new BadRequestException('no valid scope in request');
    }

    const existingConsent = await this.consents.findOne({ where: { userId, clientId: client.clientId } });
    const hasAllScopes = existingConsent && scopes.every((s) => existingConsent.scopes.includes(s));

    if (hasAllScopes) {
      const code = await this.issueAuthorizationCode(client, params, userId, username, scopes);
      return { action: 'auto-code', code };
    }

    return { action: 'consent-required', client, requestedScopes: scopes };
  }

  async grantConsent(params: AuthorizeParams, userId: number, username: string): Promise<string> {
    const client = await this.getClient(params.clientId);
    if (!client.redirectUris.includes(params.redirectUri)) {
      throw new BadRequestException('redirect_uri not registered');
    }
    const requested = params.scope ? params.scope.split(/\s+/).filter(Boolean) : client.scopes;
    const scopes = requested.filter((s) => client.scopes.includes(s));
    if (scopes.length === 0) throw new BadRequestException('no valid scope');

    await this.consents
      .upsert(
        { userId, clientId: client.clientId, scopes },
        { conflictPaths: ['userId', 'clientId'], skipUpdateIfNoValuesChanged: false },
      )
      .catch(async () => {
        // Fallback for older TypeORM if upsert fails: manual merge.
        const row = await this.consents.findOne({ where: { userId, clientId: client.clientId } });
        if (row) {
          row.scopes = scopes;
          row.grantedAt = new Date();
          await this.consents.save(row);
        } else {
          await this.consents.save(this.consents.create({ userId, clientId: client.clientId, scopes }));
        }
      });

    return this.issueAuthorizationCode(client, params, userId, username, scopes);
  }

  private async issueAuthorizationCode(
    client: OAuthClient,
    params: AuthorizeParams,
    userId: number,
    username: string,
    scopes: string[],
  ): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.store.saveCode(code, {
      clientId: client.clientId,
      userId,
      username,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      scopes,
      state: params.state,
    });
    this.log.log(`issueCode: code=${code.slice(0, 8)}... client=${client.clientId} redirect=${params.redirectUri} user=${username}`);
    return code;
  }

  // --- Token endpoint: authorization_code grant ---
  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
  }): Promise<TokenResponse> {
    this.log.debug(`exchangeCode: code=${input.code?.slice(0, 8)}... client=${input.clientId} redirect=${input.redirectUri}`);
    const payload = await this.store.consumeCode(input.code);
    if (!payload) {
      this.log.warn(`exchangeCode: code not found in store (code=${input.code?.slice(0, 8)}...)`);
      throw new UnauthorizedException('invalid or expired code');
    }
    this.log.debug(`exchangeCode: payload client=${payload.clientId} redirect=${payload.redirectUri}`);
    if (payload.clientId !== input.clientId) throw new UnauthorizedException('client_id mismatch');
    if (payload.redirectUri !== input.redirectUri) throw new UnauthorizedException('redirect_uri mismatch');

    await this.authenticateClient(input.clientId, input.clientSecret);

    if (!verifyPkce(input.codeVerifier, payload.codeChallenge, payload.codeChallengeMethod)) {
      throw new UnauthorizedException('PKCE verification failed');
    }
    return this.mintTokens(payload.clientId, payload.userId, payload.username, payload.scopes);
  }

  // --- Token endpoint: refresh_token grant with rotation ---
  async refresh(input: { refreshToken: string; clientId: string; clientSecret?: string }): Promise<TokenResponse> {
    const payload = await this.store.consumeRefresh(input.refreshToken);
    if (!payload) throw new UnauthorizedException('invalid or expired refresh_token');
    if (payload.clientId !== input.clientId) throw new UnauthorizedException('client_id mismatch');
    await this.authenticateClient(input.clientId, input.clientSecret);
    return this.mintTokens(payload.clientId, payload.userId, payload.username, payload.scopes);
  }

  private async mintTokens(clientId: string, userId: number, username: string, scopes: string[]): Promise<TokenResponse> {
    const accessToken = randomBytes(32).toString('base64url');
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + ACCESS_TTL_SEC * 1000;

    await this.store.saveAccess(accessToken, { clientId, userId, username, scopes, expiresAt });
    await this.store.saveRefresh(refreshToken, { clientId, userId, username, scopes });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SEC,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }

  private async authenticateClient(clientId: string, clientSecret?: string): Promise<void> {
    const client = await this.getClient(clientId);
    if (client.tokenEndpointAuthMethod === 'none') return; // public client — PKCE only
    if (!clientSecret) throw new UnauthorizedException('client_secret required');
    if (!client.clientSecretHash) throw new UnauthorizedException('client secret not set on record');
    const ok = await bcrypt.compare(clientSecret, client.clientSecretHash);
    if (!ok) throw new UnauthorizedException('invalid client_secret');
  }

  // --- Revocation (RFC 7009) ---
  async revoke(input: { token: string; tokenTypeHint?: 'access_token' | 'refresh_token' }): Promise<void> {
    // Try both stores; per spec revoke MUST succeed even if hint wrong.
    if (input.tokenTypeHint !== 'refresh_token') await this.store.revokeAccess(input.token);
    if (input.tokenTypeHint !== 'access_token') await this.store.revokeRefresh(input.token);
  }

  // --- Bearer verify (used by guard) ---
  async verifyBearer(token: string) {
    const payload = await this.store.getAccess(token);
    if (!payload) return null;
    if (payload.expiresAt < Date.now()) {
      await this.store.revokeAccess(token);
      return null;
    }
    return payload;
  }

  // Public client info (used by consent screen — leak only non-sensitive fields).
  async publicClientInfo(clientId: string): Promise<{ client_id: string; name: string; created_at: string }> {
    const c = await this.getClient(clientId);
    return { client_id: c.clientId, name: c.name, created_at: c.createdAt.toISOString() };
  }
}
