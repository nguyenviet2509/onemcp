import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyGitlabToken } from './verify-gitlab-token.util';

// Legacy mono-repo webhook guard — secret comes from GITLAB_WEBHOOK_SECRET env.
// Per-project guard (P7) uses ProjectHmacGuard with project.webhookSecret instead.
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
    if (!verifyGitlabToken(token, secret, req.rawBody)) {
      this.log.warn('webhook HMAC mismatch');
      throw new ForbiddenException('Invalid webhook signature');
    }
    return true;
  }
}
