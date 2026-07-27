import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthedRequest } from '../common/user-request';
import { normalizeIp } from './cidr-parser';

// Post-pivot 2026-07-27: BỎ USER_ALLOW_CIDR. Guard chỉ giữ EMERGENCY_LOCKDOWN
// short-circuit + set req.clientIp cho audit log. KHÔNG reject IP nữa.
// Access control chuyển hoàn toàn qua SSO cookie / API key.
@Injectable()
export class IpCidrGuard implements CanActivate {
  private readonly log = new Logger(IpCidrGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const path = req.originalUrl || req.url;

    // Emergency lockdown short-circuit (giữ cho ops response nhanh).
    if (this.config.get('EMERGENCY_LOCKDOWN') === 'true' && !path.startsWith('/health')) {
      throw new ServiceUnavailableException('OneMCP under emergency lockdown');
    }

    // Set clientIp cho audit downstream (không reject).
    req.clientIp = normalizeIp(req.ip ?? req.socket.remoteAddress ?? '');
    return true;
  }
}
