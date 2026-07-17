import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleCode } from '../users/entities/role.entity';

// Env-based role bootstrap cho v1 (không có auth thật + không có admin UI).
// Sau khi auth-integration plan hoàn thành, role sẽ đọc từ DB user_roles.
@Injectable()
export class RoleAssignerService {
  private readonly log = new Logger(RoleAssignerService.name);
  private readonly maintainers: Set<string>;
  private readonly admins: Set<string>;
  private readonly defaultRole: RoleCode;

  constructor(private readonly config: ConfigService) {
    this.maintainers = parseCsvSet(this.config.get('MAINTAINER_USERNAMES', ''));
    this.admins = parseCsvSet(this.config.get('ADMIN_USERNAMES', ''));
    this.defaultRole = (this.config.get('DEFAULT_ROLE') as RoleCode) || 'contributor';
    this.log.log(
      `Role bootstrap loaded: ${this.admins.size} admin(s), ${this.maintainers.size} maintainer(s), default=${this.defaultRole}`,
    );
  }

  // Trả về danh sách role code cho username (v1 flat, không dept-scoped).
  rolesFor(username: string): RoleCode[] {
    const uname = username.toLowerCase();
    if (this.admins.has(uname)) return ['super-admin'];
    if (this.maintainers.has(uname)) return ['maintainer', 'contributor'];
    return [this.defaultRole];
  }

  isAdmin(username: string): boolean {
    return this.admins.has(username.toLowerCase());
  }

  isMaintainer(username: string): boolean {
    return this.maintainers.has(username.toLowerCase());
  }
}

function parseCsvSet(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
