import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

// GitLab webhook secret token strategy:
//   - Simple mode: shared secret sent as-is in header `X-Gitlab-Token` (compare bằng timingSafeEqual).
//   - HMAC mode (nếu GitLab config `x-gitlab-token` = HMAC-SHA256 hex của body): so sánh HMAC.
// Ta support cả hai — nếu token match trực tiếp OR khớp HMAC hex thì chấp nhận.
@Injectable()
export class GitlabHmacGuard implements CanActivate {
  private readonly log = new Logger(GitlabHmacGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const secret = this.config.get<string>('GITLAB_WEBHOOK_SECRET', '');
    if (!secret) {
      this.log.warn('webhook rejected — GITLAB_WEBHOOK_SECRET empty');
      throw new ForbiddenException('Webhook disabled');
    }
    const req = ctx.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const token = String(req.header('x-gitlab-token') ?? '');
    if (!token) throw new ForbiddenException('Missing X-Gitlab-Token');

    if (this.constantTimeEq(token, secret)) return true;

    const raw = req.rawBody;
    if (raw) {
      const computed = createHmac('sha256', secret).update(raw).digest('hex');
      if (this.constantTimeEq(token, computed)) return true;
    }
    this.log.warn('webhook HMAC mismatch');
    throw new ForbiddenException('Invalid webhook signature');
  }

  private constantTimeEq(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
