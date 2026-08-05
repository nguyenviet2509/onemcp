import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

// GitLab userinfo shape from GET /api/v4/user.
export interface GitLabUserInfo {
  email: string;
  username: string;
  name: string;
}

// Internal token exchange result — access_token intentionally NOT exported
// to prevent accidental persistence or logging outside this service.
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

@Injectable()
export class GitlabOAuthService {
  private readonly log = new Logger(GitlabOAuthService.name);

  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('GITLAB_SSO_BASE_URL', 'https://gitlab.inet.vn');
    this.appId = this.config.get<string>('GITLAB_OAUTH_APP_ID', '');
    this.appSecret = this.config.get<string>('GITLAB_OAUTH_APP_SECRET', '');
    this.redirectUri = this.config.get<string>(
      'GITLAB_OAUTH_REDIRECT_URI',
      'https://202.92.5.113/api/auth/gitlab/callback',
    );
  }

  // Generate a cryptographically random PKCE code_verifier (43-128 chars, Base64URL).
  generateCodeVerifier(): string {
    return randomBytes(48).toString('base64url');
  }

  // Derive S256 code_challenge from code_verifier per RFC 7636.
  // ONLY S256 method is supported — plain is rejected.
  deriveCodeChallenge(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url');
  }

  // Build the GitLab /oauth/authorize redirect URL.
  // state and codeChallenge are stored in Redis before redirect (managed by SessionService).
  buildAuthorizeUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'read_user',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access_token via POST /oauth/token.
  // Returns access_token — caller must NOT log or persist this value.
  // Timeout: 10s, no retry (fail-fast to avoid hanging callback).
  async exchangeCode(code: string, codeVerifier: string): Promise<string> {
    this.assertCredentialsConfigured();

    const body = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: body.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`gitlab_token_exchange_error: ${msg}`);
      throw new UnauthorizedException('OAuth token exchange failed');
    }

    if (!response.ok) {
      // Log status only — never log body which may contain secrets.
      this.log.warn(`gitlab_token_exchange_bad_status status=${response.status}`);
      throw new UnauthorizedException('OAuth token exchange rejected by GitLab');
    }

    const data = (await response.json()) as TokenResponse;
    if (!data.access_token) {
      this.log.warn('gitlab_token_exchange_missing_token');
      throw new UnauthorizedException('OAuth token response missing access_token');
    }

    // access_token is returned but must NOT be logged by caller.
    return data.access_token;
  }

  // Fetch user info via GET /api/v4/user using the access_token.
  // access_token is used in Authorization header — never logged.
  async fetchUserInfo(accessToken: string): Promise<GitLabUserInfo> {
    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      response = await fetch(`${this.baseUrl}/api/v4/user`, {
        headers: {
          // Authorization header is redacted in pino-http config (req.headers.authorization).
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`gitlab_userinfo_fetch_error: ${msg}`);
      throw new UnauthorizedException('Failed to fetch GitLab user info');
    }

    if (!response.ok) {
      this.log.warn(`gitlab_userinfo_bad_status status=${response.status}`);
      throw new UnauthorizedException('GitLab user info fetch rejected');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as Record<string, any>;

    // Validate required fields at boundary.
    if (!data.email || typeof data.email !== 'string') {
      throw new UnauthorizedException('GitLab userinfo missing email field');
    }
    if (!data.username || typeof data.username !== 'string') {
      throw new UnauthorizedException('GitLab userinfo missing username field');
    }

    return {
      email: (data.email as string).toLowerCase().trim(),
      username: (data.username as string).toLowerCase().trim(),
      name: typeof data.name === 'string' ? (data.name as string) : data.username,
    };
  }

  // Validate that OAuth credentials are configured before attempting flow.
  // Throws at runtime rather than boot to allow trust-header mode without creds.
  private assertCredentialsConfigured(): void {
    if (!this.appId || !this.appSecret) {
      throw new UnauthorizedException(
        'GitLab OAuth credentials not configured (GITLAB_OAUTH_APP_ID / GITLAB_OAUTH_APP_SECRET)',
      );
    }
  }
}
