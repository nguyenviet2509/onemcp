import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { SessionService } from './session.service';

// CookieAuthMiddleware — reads onemcp_session cookie, verifies via Redis,
// sets req.user if valid. Falls through (next()) on miss; does NOT throw 401.
// 401 is enforced downstream by AuthGuard after full middleware chain runs.
// Only active when AUTH_MODE=gitlab-sso (conditional registration in AccessModule).
@Injectable()
export class CookieAuthMiddleware implements NestMiddleware {
  private readonly log = new Logger(CookieAuthMiddleware.name);

  constructor(private readonly sessions: SessionService) {}

  async use(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
    // Already authed by a preceding middleware (ApiKey) — skip.
    if (req.user) {
      next();
      return;
    }

    const cookieName = this.sessions.cookieNameValue;
    // Express parses cookies only if cookie-parser middleware is applied.
    // NestJS platform-express includes raw cookie string in req.headers.cookie.
    // We parse manually to avoid adding cookie-parser dependency.
    const token = parseCookie(req.headers.cookie, cookieName);

    if (!token) {
      next();
      return;
    }

    try {
      const session = await this.sessions.getSession(token);
      if (!session) {
        // Cookie present but session expired or not found — log and fall through.
        this.log.debug('cookie_session_miss — session expired or revoked');
        next();
        return;
      }

      // Attach user to request; sessionId available for audit interceptor.
      req.user = {
        id: session.userId,
        username: session.username,
        roles: session.roles,
        departmentId: 0, // SSO users: dept resolved from DB on demand; 0 = default
        status: 'active',
        claimedFromHeader: true, // required by RequestUser interface (v1 compat shape)
        sessionId: session.sessionId,
        email: session.email,
        displayName: session.displayName,
      };

      this.log.debug(`cookie_session_authed username=${session.username}`);
    } catch (err) {
      // Non-fatal — Redis error should not block request. Log and fall through.
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`cookie_session_lookup_error: ${msg}`);
    }

    next();
  }
}

// Parse a single named cookie from the raw Cookie header string.
// Returns undefined if the cookie is absent or empty.
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
