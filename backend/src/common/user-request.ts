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
  // Zitadel subject claim — populated by ZitadelJwtMiddleware (oauth path).
  // Null/undefined for trust-header (X-Onemcp-User) path. Required for bridge tools (Path C guard).
  zitadelSub?: string | null;
  // Auth path marker — 'oauth' for Zitadel JWT / OneMCP Bearer OAuth, 'header' for X-Onemcp-User legacy.
  // Bridge tools reject 'header' path (no verifiable sub claim for downstream RBAC).
  authPath?: 'oauth' | 'header';
}

export interface AuthedRequest extends Request {
  user?: RequestUser;
  clientIp: string; // Set by IpCidrGuard sau khi normalize.
}
