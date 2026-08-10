import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { OAuthService } from './oauth.service';

// Sits between ApiKeyMiddleware and TrustUserMiddleware.
// If Authorization: Bearer <token> present → verify OAuth access token → set req.user.
// If invalid Bearer AND MCP_AUTH_MODE=required for /api/mcp path → 401.
// Otherwise fall through (trust middleware or Api Key handles).
//
// MCP_AUTH_MODE:
//   off (default)  — Bearer verification skipped entirely (backward compat)
//   optional       — Bearer accepted if present; missing/invalid falls through to trust
//   required       — Bearer mandatory for /api/mcp/*; other paths still fall through
@Injectable()
export class BearerAuthMiddleware implements NestMiddleware {
  private readonly log = new Logger(BearerAuthMiddleware.name);
  private readonly mode: 'off' | 'optional' | 'required';

  constructor(private readonly config: ConfigService, private readonly oauth: OAuthService) {
    const raw = (this.config.get<string>('MCP_AUTH_MODE') ?? 'off').toLowerCase();
    this.mode = (['off', 'optional', 'required'] as const).find((m) => m === raw) ?? 'off';
    if (this.mode !== 'off') this.log.log(`Bearer auth mode: ${this.mode}`);
  }

  async use(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    if (this.mode === 'off') {
      next();
      return;
    }

    // Already authenticated by ApiKeyMiddleware — skip.
    if (req.user) {
      next();
      return;
    }

    const auth = String(req.headers['authorization'] ?? '');
    const hasBearer = auth.toLowerCase().startsWith('bearer ');
    const path = req.originalUrl || req.url;
    const isMcpPath = path.startsWith('/api/mcp');

    if (!hasBearer) {
      if (this.mode === 'required' && isMcpPath) {
        res.setHeader('WWW-Authenticate', 'Bearer error="missing_token"');
        res.status(401).json({ error: 'missing_token' });
        return;
      }
      next();
      return;
    }

    const token = auth.slice(7).trim();
    const payload = token ? await this.oauth.verifyBearer(token) : null;
    if (!payload) {
      if (this.mode === 'required' && isMcpPath) {
        res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
        res.status(401).json({ error: 'invalid_token' });
        return;
      }
      // Optional mode: invalid Bearer falls through, trust-user may still auth via header.
      next();
      return;
    }

    req.user = {
      id: payload.userId,
      username: payload.username,
      roles: ['contributor'],
      departmentId: 0,
      status: 'active',
      claimedFromHeader: true,
    };
    next();
  }
}
