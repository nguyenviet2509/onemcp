import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { RoleCode } from '../users/entities/role.entity';
import { UsersService } from '../users/users.service';
import { RoleAssignerService } from '../access/role-assigner.service';
import { AuthedRequest } from '../common/user-request';
import { CallbackQuerySchema } from './dto/callback-query.dto';
import { GitlabOAuthService } from './gitlab-oauth.service';
import { SessionService } from './session.service';

// All auth endpoints are prefixed /api/auth (app global prefix = /api, controller = auth).
// These routes are PUBLIC — must be excluded from AuthGuard via IS_PUBLIC decorator or
// access module routing (see access.module.ts). Phase 1 approach: no guard on /auth/*.
@Controller('auth')
export class AuthController {
  private readonly log = new Logger(AuthController.name);
  private readonly cookieName: string;
  private readonly sessionTtl: number;
  private readonly cookieSecure: boolean;
  private readonly allowedReturnToPrefixes = ['/', '/api'] as const;

  constructor(
    private readonly gitlab: GitlabOAuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly roles: RoleAssignerService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = this.config.get<string>('SESSION_COOKIE_NAME', 'onemcp_session');
    this.sessionTtl = this.config.get<number>('SESSION_TTL_SECONDS', 86400);
    // Secure flag off for non-prod (localhost http dev). Cookies won't send over http otherwise.
    this.cookieSecure = this.config.get<string>('NODE_ENV') === 'production';
  }

  // GET /api/auth/gitlab/login?returnTo=/
  // Initiates OAuth2 + PKCE flow. Generates state nonce + code_verifier,
  // stores in Redis, then redirects browser to GitLab authorize URL.
  @Get('gitlab/login')
  async login(@Query('returnTo') rawReturnTo: string | undefined, @Res() res: Response): Promise<void> {
    const returnTo = this.sanitizeReturnTo(rawReturnTo);

    const codeVerifier = this.gitlab.generateCodeVerifier();
    const codeChallenge = this.gitlab.deriveCodeChallenge(codeVerifier);

    // Store state → {codeVerifier, returnTo} in Redis. State is the nonce UUID.
    const state = await this.sessions.createState(codeVerifier, returnTo);

    const authorizeUrl = this.gitlab.buildAuthorizeUrl(state, codeChallenge);

    this.log.log(`oauth_login_redirect state=[redacted] returnTo=${returnTo}`);
    res.redirect(302, authorizeUrl);
  }

  // GET /api/auth/gitlab/callback?code=...&state=...
  // OAuth2 callback: validates state, exchanges code, fetches user, upserts, creates session.
  @Get('gitlab/callback')
  async callback(@Query() rawQuery: Record<string, string>, @Res() res: Response): Promise<void> {
    // Validate callback query params at system boundary.
    const parsed = CallbackQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      this.log.warn(`oauth_callback_invalid_params: ${parsed.error.message}`);
      throw new BadRequestException('Invalid OAuth callback parameters');
    }

    const { code, state } = parsed.data;

    // Consume state nonce — DEL on read prevents replay attacks.
    const statePayload = await this.sessions.consumeState(state);
    if (!statePayload) {
      this.log.warn('oauth_callback_state_miss — state expired, replayed, or unknown');
      throw new UnauthorizedException('OAuth state invalid or expired');
    }

    const { codeVerifier, returnTo } = statePayload;

    // Exchange authorization code for access token. Token is scoped to this method only.
    // Never stored, never logged beyond this call boundary.
    let accessToken: string;
    try {
      accessToken = await this.gitlab.exchangeCode(code, codeVerifier);
    } catch (err) {
      this.log.error(`oauth_code_exchange_failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new UnauthorizedException('OAuth code exchange failed');
    }

    // Fetch GitLab user info. Access token used in Authorization header (redacted by pino).
    let userInfo: Awaited<ReturnType<GitlabOAuthService['fetchUserInfo']>>;
    try {
      userInfo = await this.gitlab.fetchUserInfo(accessToken);
    } catch (err) {
      this.log.error(`oauth_userinfo_failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new UnauthorizedException('Failed to fetch GitLab user info');
    }
    // accessToken goes out of scope here — not retained.

    // Upsert user in DB via ensureByEmail. Validates @inet.vn domain.
    let ensured: Awaited<ReturnType<UsersService['ensureByEmail']>>;
    try {
      ensured = await this.users.ensureByEmail(userInfo.email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`oauth_user_upsert_failed email=[redacted]: ${msg}`);
      throw new UnauthorizedException('User provisioning failed — ensure @inet.vn email');
    }

    // Assign role via env-based bootstrap (ADMIN_USERNAMES / MAINTAINER_USERNAMES).
    const assignedRoles: RoleCode[] = this.roles.rolesFor(ensured.username);

    // Fetch full user record to get DB id.
    const dbUser = await this.users.findByUsername(ensured.username);
    if (!dbUser) {
      throw new UnauthorizedException('User record not found after upsert');
    }

    // Create Redis session — token is opaque UUID (128-bit entropy).
    const sessionToken = await this.sessions.createSession({
      userId: dbUser.id,
      username: dbUser.username,
      email: userInfo.email,
      displayName: userInfo.name,
      roles: assignedRoles,
    });

    this.log.log(`oauth_login_success username=${ensured.username} created=${ensured.created}`);

    // Set HttpOnly session cookie. SameSite=Lax: CSRF-safe for GET-initiated flows.
    // Secure=true: enforced since backend is only reachable via HTTPS in prod.
    res.cookie(this.cookieName, sessionToken, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: this.sessionTtl * 1000, // ms
    });

    res.redirect(302, this.sanitizeReturnTo(returnTo));
  }

  // POST /api/auth/logout
  // Revokes Redis session + clears cookie. Idempotent — safe to call multiple times.
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = parseCookie(req.headers.cookie, this.cookieName);
    if (token) {
      await this.sessions.revokeSession(token);
      this.log.log('oauth_logout — session revoked');
    }

    // Clear cookie regardless of whether session existed.
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: '/',
    });

    res.json({ ok: true, message: 'Logged out' });
  }

  // GET /api/auth/me
  // Returns current session user snapshot. 401 if not authenticated.
  @Get('me')
  me(@Req() req: AuthedRequest) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    // Return safe user snapshot — no cookie value or sensitive fields.
    return {
      id: req.user.id,
      username: req.user.username,
      roles: req.user.roles,
      status: req.user.status,
    };
  }

  // Sanitize returnTo to prevent open-redirect attacks.
  // Only relative paths starting with / are allowed.
  private sanitizeReturnTo(raw: string | undefined): string {
    if (!raw) return '/';
    const decoded = decodeURIComponent(raw);
    // Allow only paths starting with / (relative URLs only, no protocol).
    if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('\n') && !decoded.includes('\r')) {
      return decoded;
    }
    this.log.warn(`oauth_open_redirect_blocked returnTo=[redacted]`);
    return '/';
  }
}

// Parse a single named cookie from the raw Cookie header string.
function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length).trim();
      return value || undefined;
    }
  }
  return undefined;
}
