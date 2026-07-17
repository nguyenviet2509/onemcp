import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CIDRMatcher from 'cidr-matcher';
import { AuthedRequest } from '../common/user-request';
import { normalizeIp, parseCidrList } from './cidr-parser';

// User-scope CIDR guard. Chạy TRƯỚC mọi guard/middleware khác.
// Reject nếu client IP không trong USER_ALLOW_CIDR.
// Cũng enforce EMERGENCY_LOCKDOWN → 503 (trừ /health).
@Injectable()
export class IpCidrGuard implements CanActivate {
  private readonly log = new Logger(IpCidrGuard.name);
  private readonly userMatcher: CIDRMatcher;
  private readonly trustedProxy: CIDRMatcher;

  constructor(private readonly config: ConfigService) {
    this.userMatcher = parseCidrList(this.config.get<string>('USER_ALLOW_CIDR', ''));
    this.trustedProxy = parseCidrList(this.config.get<string>('TRUSTED_PROXY_CIDR', '127.0.0.1/32'));
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const path = req.originalUrl || req.url;

    // Emergency lockdown short-circuit.
    if (this.config.get('EMERGENCY_LOCKDOWN') === 'true' && !path.startsWith('/health')) {
      throw new ServiceUnavailableException('OneMCP under emergency lockdown');
    }

    // Health/ready open (dùng cho docker healthcheck từ internal network).
    if (path === '/health' || path === '/ready') return true;

    // Webhooks bypass CIDR — GitLab egress IPs không cố định.
    // Auth thông qua HMAC (GitlabHmacGuard) + shared secret.
    if (path.startsWith('/api/webhooks/')) return true;

    const clientIp = this.resolveClientIp(req);
    req.clientIp = clientIp;

    if (!this.userMatcher.contains(clientIp)) {
      this.log.warn(`ip_rejected ${clientIp} → ${path}`);
      throw new ForbiddenException('Access denied by IP allowlist');
    }
    return true;
  }

  // Extract real client IP. Nếu request đến từ trusted proxy → dùng X-Forwarded-For chain.
  private resolveClientIp(req: AuthedRequest): string {
    const remote = normalizeIp(req.ip ?? req.socket.remoteAddress ?? '');
    if (!remote) return '0.0.0.0';

    // Nếu remote là trusted proxy → tin X-Forwarded-For.
    if (this.trustedProxy.contains(remote)) {
      const xff = (req.headers['x-forwarded-for'] as string) || '';
      const forwarded = xff.split(',').map((s) => s.trim()).filter(Boolean);
      if (forwarded.length > 0) return normalizeIp(forwarded[0]);
    }
    return remote;
  }
}
