import { BadRequestException, ForbiddenException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { UsersService } from '../users/users.service';
import { RoleAssignerService } from './role-assigner.service';
import { normalizeIp } from './cidr-parser';

// V1 identity: đọc X-Onemcp-User header → upsert user → attach req.user.
// Post-pivot 2026-07-27: BỎ CIDR check cho privileged role claim.
// Roles cấp thuần theo env `ADMIN_USERNAMES` / `MAINTAINER_USERNAMES` username match.
// Sẽ được thay hoàn toàn bằng SSO cookie auth ở plan 260727-0843.
const USERNAME_RE = /^[a-z0-9._-]{2,32}$/;

@Injectable()
export class TrustUserMiddleware implements NestMiddleware {
  private readonly log = new Logger(TrustUserMiddleware.name);
  private readonly headerName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly roles: RoleAssignerService,
  ) {
    this.headerName = (this.config.get<string>('TRUST_USER_HEADER') || 'X-Onemcp-User').toLowerCase();
  }

  async use(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
    const path = req.originalUrl || req.url;
    if (path === '/health' || path === '/ready' || path === '/metrics') {
      next();
      return;
    }
    // Webhooks không có identity header — bypass, auth qua HMAC.
    if (path.startsWith('/api/webhooks/')) {
      next();
      return;
    }

    // If ApiKeyMiddleware already authenticated this request, skip trust-header processing.
    if (req.user) {
      next();
      return;
    }

    const raw = req.headers[this.headerName];
    const claim = Array.isArray(raw) ? raw[0] : raw;
    if (!claim) {
      throw new BadRequestException(`Missing identity header ${this.headerName}`);
    }

    const username = claim.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      throw new BadRequestException('Invalid username format');
    }

    const assigned = this.roles.rolesFor(username);

    // Set clientIp cho downstream (audit log). KHÔNG CIDR check role claim nữa
    // (post-pivot 260727: bỏ ADMIN_ALLOW_CIDR).
    req.clientIp = normalizeIp(req.ip ?? req.socket.remoteAddress ?? '');

    const user = await this.users.upsertByUsername(username);
    if (user.status === 'disabled') {
      throw new ForbiddenException('User disabled');
    }

    req.user = {
      id: user.id,
      username: user.username,
      roles: assigned,
      departmentId: user.departmentId,
      status: user.status,
      claimedFromHeader: true,
    };
    next();
  }
}
