import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CIDRMatcher from 'cidr-matcher';
import { AuthedRequest } from '../common/user-request';
import { parseCidrList } from './cidr-parser';

// Admin-scope guard — strictier hơn IpCidrGuard.
// Áp cho /admin/* routes + admin actions. Không thay thế IpCidrGuard, chạy sau.
// C3 mitigation từ red-team review.
@Injectable()
export class AdminCidrGuard implements CanActivate {
  private readonly log = new Logger(AdminCidrGuard.name);
  private readonly adminMatcher: CIDRMatcher;

  constructor(private readonly config: ConfigService) {
    this.adminMatcher = parseCidrList(this.config.get<string>('ADMIN_ALLOW_CIDR', ''));
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const ip = req.clientIp ?? req.ip ?? '';
    if (!this.adminMatcher.contains(ip)) {
      this.log.warn(`admin_ip_rejected ${ip} → ${req.originalUrl}`);
      throw new ForbiddenException('Admin routes chỉ cho phép từ ADMIN_ALLOW_CIDR');
    }
    return true;
  }

  // Helper để kiểm tra IP có admin capability trước khi trust role claim từ header.
  isAdminIp(ip: string): boolean {
    return this.adminMatcher.contains(ip);
  }
}
