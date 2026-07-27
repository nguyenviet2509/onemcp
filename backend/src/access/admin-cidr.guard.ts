import { CanActivate, Injectable, Logger } from '@nestjs/common';

// Post-pivot 2026-07-27: BỎ CIDR gate. Guard giữ interface để không đụng
// consumer (templates/spaces controllers), luôn trả true. Admin auth chuyển
// hoàn toàn qua RBAC role từ SSO / env `ADMIN_USERNAMES`.
// Sẽ xoá file này ở SSO plan Phase 1 cleanup.
@Injectable()
export class AdminCidrGuard implements CanActivate {
  private readonly log = new Logger(AdminCidrGuard.name);

  canActivate(): boolean {
    return true;
  }

  isAdminIp(_ip: string): boolean {
    return true;
  }
}
