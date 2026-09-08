import { Request } from 'express';
import { RoleCode } from '../users/entities/role.entity';

// Extended request payload attached by TrustUserMiddleware.
// After v1 -> v2 auth swap, chỉ cần thay middleware, shape này giữ nguyên.
export interface RequestUser {
  id: number;
  username: string;
  roles: RoleCode[];
  departmentId: number;
  status: 'active' | 'disabled';
  claimedFromHeader: true; // Đánh dấu v1 identity — non-cryptographic.
  // OAuth 2.1 client_id (DCR) — populated by BearerAuthMiddleware only.
  // Undefined cho trust-header path (portal). Dùng cho audit session correlation.
  clientId?: string;
}

export interface AuthedRequest extends Request {
  user?: RequestUser;
  clientIp: string; // Set by IpCidrGuard sau khi normalize.
}
