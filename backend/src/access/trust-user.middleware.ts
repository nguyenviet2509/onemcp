import { BadRequestException, ForbiddenException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { UsersService } from '../users/users.service';
import { RoleAssignerService } from './role-assigner.service';
import { AdminCidrGuard } from './admin-cidr.guard';

// V1 identity: đọc X-Onemcp-User header → upsert user → attach req.user.
// Validate:
//   - Header bắt buộc (trừ /health)
//   - Username regex chặt để tránh pollution
//   - Role claim admin/maintainer từ non-admin CIDR → reject (C1/C3 mitigation)
//   - User status=disabled → reject 403 (C4 mitigation)
const USERNAME_RE = /^[a-z0-9._-]{2,32}$/;

@Injectable()
export class TrustUserMiddleware implements NestMiddleware {
  private readonly log = new Logger(TrustUserMiddleware.name);
  private readonly headerName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly roles: RoleAssignerService,
    private readonly adminGuard: AdminCidrGuard,
  ) {
    this.headerName = (this.config.get<string>('TRUST_USER_HEADER') || 'X-Onemcp-User').toLowerCase();
  }

  async use(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
    const path = req.originalUrl || req.url;
    if (path === '/health' || path === '/ready') {
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
    const isPrivileged = assigned.some((r) => r === 'super-admin' || r === 'maintainer' || r === 'dept-admin');

    // C1/C3 mitigation: role privileged phải từ ADMIN_ALLOW_CIDR.
    if (isPrivileged && !this.adminGuard.isAdminIp(req.clientIp)) {
      this.log.warn(`impersonation_attempt username=${username} ip=${req.clientIp}`);
      throw new ForbiddenException('Privileged role claim from non-admin IP');
    }

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
