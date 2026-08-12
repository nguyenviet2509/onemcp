import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { UsersService } from '../users/users.service';
import { RoleAssignerService } from '../access/role-assigner.service';
import { OAuthService } from './oauth.service';

// Sits between ApiKeyMiddleware and TrustUserMiddleware.
// If Authorization: Bearer <token> present → verify OAuth access token → set req.user.
// If invalid Bearer AND MCP_AUTH_MODE=required for /api/mcp path → 401.
// Otherwise fall through (trust middleware or Api Key handles).
//
// MCP_AUTH_MODE:
//   off (default)  — Bearer verification skipped entirely (backward compat)
//   optional       — Bearer accepted if present; missing/invalid falls through to trust
//   required       — Bearer mandatory for /api/mcp/*; other paths still fall through
@Injectable()
export class BearerAuthMiddleware implements NestMiddleware {
  private readonly log = new Logger(BearerAuthMiddleware.name);
  private readonly mode: 'off' | 'optional' | 'required';

  constructor(
    private readonly config: ConfigService,
    private readonly oauth: OAuthService,
    private readonly users: UsersService,
    private readonly roles: RoleAssignerService,
  ) {
    const raw = (this.config.get<string>('MCP_AUTH_MODE') ?? 'off').toLowerCase();
    this.mode = (['off', 'optional', 'required'] as const).find((m) => m === raw) ?? 'off';
    if (this.mode !== 'off') this.log.log(`Bearer auth mode: ${this.mode}`);
  }

  async use(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    if (this.mode === 'off') {
      next();
      return;
    }

    // Already authenticated by ApiKeyMiddleware — skip.
    if (req.user) {
      next();
      return;
    }

    const auth = String(req.headers['authorization'] ?? '');
    const hasBearer = auth.toLowerCase().startsWith('bearer ');
    const path = req.originalUrl || req.url;
    const isMcpPath = path.startsWith('/api/mcp');

    if (!hasBearer) {
      // Optional mode: nếu MCP path không có Bearer VÀ không có trust-header
      // → trả 401 + WWW-Authenticate để mcp-remote tự trigger OAuth flow.
      // Trust-header (X-Onemcp-User) vẫn work cho internal OpenWebUI actions.
      // Không có block này thì TrustUserMiddleware sẽ throw 400 → mcp-remote fatal (RFC 6750: cần 401).
      const hasTrustHeader = Boolean(req.headers['x-onemcp-user']);
      const shouldChallenge =
        (this.mode === 'required' && isMcpPath) ||
        (this.mode === 'optional' && isMcpPath && !hasTrustHeader);
      if (shouldChallenge) {
        const issuer = this.config.get<string>('OAUTH_ISSUER') || '';
        const resourceMetadata = issuer
          ? `, resource_metadata="${issuer}/.well-known/oauth-protected-resource"`
          : '';
        res.setHeader('WWW-Authenticate', `Bearer error="missing_token"${resourceMetadata}`);
        res.status(401).json({ error: 'missing_token' });
        return;
      }
      next();
      return;
    }

    const token = auth.slice(7).trim();
    const payload = token ? await this.oauth.verifyBearer(token) : null;
    if (!payload) {
      // Cùng logic với missing-token: MCP path + invalid Bearer + không có trust-header
      // → 401 + WWW-Authenticate để client refresh/re-OAuth.
      const hasTrustHeader = Boolean(req.headers['x-onemcp-user']);
      const shouldChallenge =
        (this.mode === 'required' && isMcpPath) ||
        (this.mode === 'optional' && isMcpPath && !hasTrustHeader);
      if (shouldChallenge) {
        const issuer = this.config.get<string>('OAUTH_ISSUER') || '';
        const resourceMetadata = issuer
          ? `, resource_metadata="${issuer}/.well-known/oauth-protected-resource"`
          : '';
        res.setHeader('WWW-Authenticate', `Bearer error="invalid_token"${resourceMetadata}`);
        res.status(401).json({ error: 'invalid_token' });
        return;
      }
      // Optional non-MCP path hoặc có trust-header: fall through cho TrustUserMiddleware.
      next();
      return;
    }

    // Lookup user thật từ DB để lấy departmentId + status thực tế.
    // Trước đây hardcode departmentId=0 → search/list_artifacts filter dept_id=0 → 0 kết quả
    // (bug khiến Claude Desktop OAuth không thấy artifact nào của dept mình).
    const dbUser = await this.users.findById(payload.userId);
    if (!dbUser) {
      // Token valid nhưng user bị xoá khỏi DB → treat như invalid token.
      const hasTrustHeader = Boolean(req.headers['x-onemcp-user']);
      const shouldChallenge =
        (this.mode === 'required' && isMcpPath) ||
        (this.mode === 'optional' && isMcpPath && !hasTrustHeader);
      if (shouldChallenge) {
        const issuer = this.config.get<string>('OAUTH_ISSUER') || '';
        const resourceMetadata = issuer
          ? `, resource_metadata="${issuer}/.well-known/oauth-protected-resource"`
          : '';
        res.setHeader('WWW-Authenticate', `Bearer error="invalid_token"${resourceMetadata}`);
        res.status(401).json({ error: 'user_not_found' });
        return;
      }
      next();
      return;
    }
    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      roles: this.roles.rolesFor(dbUser.username),
      departmentId: dbUser.departmentId,
      status: dbUser.status,
      claimedFromHeader: true,
    };
    next();
  }
}
