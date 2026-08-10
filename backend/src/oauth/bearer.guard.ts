import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { OAuthService } from './oauth.service';

// OAuth 2.1 Bearer token guard for MCP endpoints.
// Verifies `Authorization: Bearer <opaque>` against Redis token store.
// On success, populates req.user with same shape as trust-user middleware
// so downstream code doesn't branch.
@Injectable()
export class BearerGuard implements CanActivate {
  private readonly log = new Logger(BearerGuard.name);

  constructor(private readonly oauth: OAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & AuthedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const auth = String(req.header('authorization') ?? '');
    if (!auth.toLowerCase().startsWith('bearer ')) {
      res.setHeader('WWW-Authenticate', 'Bearer error="missing_token"');
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = auth.slice(7).trim();
    const payload = token ? await this.oauth.verifyBearer(token) : null;
    if (!payload) {
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw new UnauthorizedException('Invalid or expired token');
    }

    req.user = {
      id: payload.userId,
      username: payload.username,
      roles: ['contributor'],
      departmentId: 0,
      status: 'active',
      claimedFromHeader: true,
    };
    return true;
  }
}
