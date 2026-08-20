import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyGetKey } from 'jose';
import { AuthedRequest } from '../common/user-request';
import { UsersService } from '../users/users.service';
import { RoleCode } from '../users/entities/role.entity';

// ZitadelJwtMiddleware — Cơ chế 2 (plan 260819-1628 phase-03).
// Verify JWT Bearer từ portal forward. Chèn TRƯỚC BearerAuthMiddleware:
//   Zitadel JWT → this middleware xử lý (iss = ZITADEL_ISSUER)
//   OneMCP opaque token (Claude/ChatGPT MCP client) → fall through BearerAuthMiddleware
//   Không có Bearer → fall through TrustUserMiddleware (IAP header path)
//
// Env:
//   ZITADEL_OIDC_ENABLED     — bật/tắt middleware (dual-mode với IAP)
//   ZITADEL_ISSUER           — http://10.200.0.125 (khớp iss claim)
//   ZITADEL_JWKS_URI         — http://10.200.0.125/oauth/v2/keys
//   ZITADEL_CLIENT_ID        — audience check (aud claim phải chứa client_id)
//
// Role mapping Zitadel → OneMCP RoleCode:
//   admin  → super-admin
//   editor → maintainer
//   viewer → contributor
// Fallback: user không có role Zitadel → contributor (default).

type ZitadelClaims = JWTPayload & {
  roles?: unknown; // Actions v1 (deprecated) — không dùng
  'urn:zitadel:iam:org:project:roles'?: Record<string, Record<string, string>>;
  email?: string;
  preferred_username?: string;
  name?: string;
};

const USERNAME_RE = /^[a-z0-9._-]{2,32}$/;

// Map Zitadel role key → OneMCP RoleCode. Contract documented in
// docs/authway-role-catalog.md. Multi-role: priority = super-admin > maintainer > contributor.
function mapZitadelRoles(zitadelRoles: string[]): RoleCode[] {
  const roles = new Set<RoleCode>();
  for (const r of zitadelRoles) {
    if (r === 'admin') roles.add('super-admin');
    else if (r === 'editor') roles.add('maintainer');
    else if (r === 'viewer') roles.add('contributor');
  }
  if (roles.size === 0) roles.add('contributor'); // default fallback
  // Ensure maintainer implies contributor for backward compat (RoleAssignerService pattern).
  if (roles.has('maintainer')) roles.add('contributor');
  return Array.from(roles);
}

// Extract role keys từ raw Zitadel claim `urn:zitadel:iam:org:project:roles`.
// Structure: {"admin": {"orgId": "orgDomain"}, "viewer": {...}}.
// Return keys array. Action v1 flatten không dùng (bypass on v4.16 login_v2).
function extractZitadelRoles(payload: ZitadelClaims): string[] {
  const raw = payload['urn:zitadel:iam:org:project:roles'];
  if (raw && typeof raw === 'object') return Object.keys(raw);
  return [];
}

// Derive username từ email/preferred_username (local-part).
// Backward compat với TrustUserMiddleware username regex.
function usernameFromEmail(email?: string, preferred?: string): string | null {
  const src = email ?? preferred ?? '';
  const localPart = src.split('@')[0].toLowerCase();
  if (!USERNAME_RE.test(localPart)) return null;
  return localPart;
}

@Injectable()
export class ZitadelJwtMiddleware implements NestMiddleware {
  private readonly log = new Logger(ZitadelJwtMiddleware.name);
  private readonly enabled: boolean;
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly getKey: JWTVerifyGetKey | null;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    this.enabled = this.config.get<string>('ZITADEL_OIDC_ENABLED') === 'true';
    this.issuer = this.config.get<string>('ZITADEL_ISSUER') ?? '';
    this.clientId = this.config.get<string>('ZITADEL_CLIENT_ID') ?? '';
    const jwksUri = this.config.get<string>('ZITADEL_JWKS_URI') ?? '';

    if (this.enabled && this.issuer && this.clientId && jwksUri) {
      this.getKey = createRemoteJWKSet(new URL(jwksUri));
      this.log.log(`Zitadel JWT enabled: issuer=${this.issuer} aud=${this.clientId}`);
    } else {
      this.getKey = null;
      if (this.enabled) {
        this.log.warn('ZITADEL_OIDC_ENABLED=true nhưng thiếu ISSUER/CLIENT_ID/JWKS_URI — skipping');
      }
    }
  }

  async use(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
    if (!this.enabled || !this.getKey) {
      next();
      return;
    }
    // Đã auth bởi middleware trước (ApiKey) — skip.
    if (req.user) {
      next();
      return;
    }

    const auth = String(req.headers['authorization'] ?? '');
    if (!auth.toLowerCase().startsWith('bearer ')) {
      next();
      return;
    }

    const token = auth.slice(7).trim();
    if (!token) {
      next();
      return;
    }

    // Quick JWT format check — 3 base64url segments separated by dots.
    // Opaque OneMCP token không match → fall through cho BearerAuthMiddleware.
    if (token.split('.').length !== 3) {
      next();
      return;
    }

    try {
      const { payload } = await jwtVerify(token, this.getKey, {
        issuer: this.issuer,
        audience: this.clientId,
      });
      const claims = payload as ZitadelClaims;

      const username = usernameFromEmail(claims.email, claims.preferred_username);
      if (!username) {
        // Invalid username format từ email — không phải fatal, fall through cho middleware khác.
        this.log.warn(`Zitadel JWT valid nhưng email/preferred_username không match regex`);
        next();
        return;
      }

      const zitadelRoles = extractZitadelRoles(claims);
      const mappedRoles = mapZitadelRoles(zitadelRoles);

      const dbUser = await this.users.upsertByUsername(username);
      if (dbUser.status === 'disabled') {
        // Không throw — TrustUserMiddleware sẽ throw ForbiddenException nếu cần.
        // Nhưng ta đã có valid JWT → set user và để controller quyết.
        // Actually giữ symmetry với BearerAuthMiddleware: throw hoặc log-fall-through?
        // Fall through — TrustUserMiddleware xử lý (path exempt logic khớp nhau).
        this.log.warn(`Zitadel JWT user disabled: ${username}`);
        next();
        return;
      }

      req.user = {
        id: dbUser.id,
        username: dbUser.username,
        roles: mappedRoles,
        departmentId: dbUser.departmentId,
        status: dbUser.status,
        claimedFromHeader: true, // JWT verified — cryptographic. Field tên legacy.
      };
      next();
    } catch (err) {
      // JWT invalid / expired / wrong iss/aud → fall through cho middleware khác.
      // Log warn để debug được. Không expose reason cho client (security).
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`Zitadel JWT verify failed: ${msg}`);
      next();
    }
  }
}
