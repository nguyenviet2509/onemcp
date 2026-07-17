import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

// AlertmanagerTokenGuard — Bearer token constant-time compare (RT-1).
// Alertmanager CANNOT sign webhook bodies (unlike GitLab), so we use
// the `authorization: Bearer <token>` http_config in the receiver.
// DO NOT reuse GitlabHmacGuard — different auth contract entirely.
@Injectable()
export class AlertmanagerTokenGuard implements CanActivate {
  private readonly log = new Logger(AlertmanagerTokenGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const secret = this.config.get<string>('ALERTMANAGER_WEBHOOK_TOKEN', '');
    if (!secret) {
      this.log.warn('alertmanager webhook disabled — ALERTMANAGER_WEBHOOK_TOKEN not set');
      throw new UnauthorizedException('Webhook not configured');
    }
    // H3 fix: enforce min-length to prevent weak secrets (brute-force resistance).
    if (secret.length < 32) {
      this.log.error(
        `ALERTMANAGER_WEBHOOK_TOKEN too short (${secret.length} chars) — must be >= 32`,
      );
      throw new UnauthorizedException('Webhook token misconfigured');
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const authHeader = req.header('authorization') ?? '';

    // Expect: "Bearer <token>"
    const match = authHeader.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      this.log.warn('alertmanager auth missing or malformed authorization header');
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const provided = match[1];
    if (!this.constantTimeEq(provided, secret)) {
      this.log.warn('alertmanager bearer token mismatch');
      throw new UnauthorizedException('Invalid bearer token');
    }

    return true;
  }

  // Constant-time string comparison to prevent timing attacks.
  // Pad shorter buffer to equal length before timingSafeEqual.
  private constantTimeEq(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      // Still do a dummy comparison to avoid short-circuit timing leak.
      timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return timingSafeEqual(ba, bb);
  }
}
