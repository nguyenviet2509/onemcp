import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { ApiKeysService } from './api-keys.service';

// API key middleware — sits BEFORE TrustUserMiddleware in the chain.
// If X-Onemcp-Key header is present: verify → set req.user or return 401/429.
// If header is absent: fall through to TrustUserMiddleware (no-op here).
const KEY_HEADER = 'x-onemcp-key';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  private readonly log = new Logger(ApiKeyMiddleware.name);

  constructor(private readonly apiKeys: ApiKeysService) {}

  async use(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    const raw = req.headers[KEY_HEADER];
    const rawKey = Array.isArray(raw) ? raw[0] : raw;

    // No key header — fall through to next middleware (trust-header path).
    if (!rawKey) {
      next();
      return;
    }

    // Extract prefix for rate-limit pre-check (avoid bcrypt under flood).
    const prefix = rawKey.startsWith('omk_') && rawKey.length >= 12 ? rawKey.slice(0, 12) : null;
    if (prefix && this.apiKeys.isRateLimited(prefix)) {
      this.log.warn(`api_key_rate_limited prefix=${prefix} ip=${req.ip}`);
      res.status(429).json({ message: 'Too Many Requests — API key rate limit exceeded (60 req/min)' });
      return;
    }

    const identity = await this.apiKeys.verify(rawKey);
    if (!identity) {
      this.log.warn(`api_key_invalid prefix=${prefix ?? 'unknown'} ip=${req.ip}`);
      res.status(401).json({ message: 'Invalid or expired API key' });
      return;
    }

    // Populate req.user so downstream guards/controllers work identically to trust-header path.
    req.user = {
      id: identity.id,
      username: identity.username,
      roles: [identity.role as 'contributor'],
      departmentId: 0,   // will be filled by users lookup if needed — contributor default
      status: 'active',
      claimedFromHeader: true,
    };

    this.log.debug(`api_key_authed username=${identity.username} prefix=${prefix}`);
    next();
  }
}
