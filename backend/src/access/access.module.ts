import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyMiddleware } from '../api-keys/api-key.middleware';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { CookieAuthMiddleware } from '../auth/cookie-auth.middleware';
import { AdminCidrGuard } from './admin-cidr.guard';
import { IpCidrGuard } from './ip-cidr.guard';
import { RoleAssignerService } from './role-assigner.service';
import { TrustUserMiddleware } from './trust-user.middleware';

// Access module — v1 IP CIDR + trust header identity.
// APP_GUARD đăng ký IpCidrGuard global (chạy trước mọi guard khác).
//
// Middleware chain order:
//   AUTH_MODE=trust-header (default / rollback):
//     1. IpCidrGuard (APP_GUARD, sets clientIp, emergency lockdown)
//     2. ApiKeyMiddleware (X-Onemcp-Key → set req.user, or fall through)
//     3. TrustUserMiddleware (X-Onemcp-User fallback)
//
//   AUTH_MODE=gitlab-sso (post-pivot):
//     1. IpCidrGuard (APP_GUARD, sets clientIp, emergency lockdown)
//     2. CookieAuthMiddleware (session cookie → set req.user, or fall through)
//     3. ApiKeyMiddleware (X-Onemcp-Key → set req.user, or fall through)
//     4. TrustUserMiddleware (bridge trust-header fallback — CIDR-restricted)
@Global()
@Module({
  imports: [UsersModule, ApiKeysModule, AuthModule],
  providers: [
    RoleAssignerService,
    AdminCidrGuard,
    { provide: APP_GUARD, useClass: IpCidrGuard },
  ],
  exports: [RoleAssignerService, AdminCidrGuard],
})
export class AccessModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    const authMode = this.config.get<string>('AUTH_MODE', 'trust-header');

    if (authMode === 'gitlab-sso') {
      // SSO mode: CookieAuth runs first, then ApiKey, then TrustUser (bridge fallback).
      consumer.apply(CookieAuthMiddleware, ApiKeyMiddleware, TrustUserMiddleware).forRoutes('*');
    } else {
      // Legacy trust-header mode: unchanged from v1.5 behavior.
      consumer.apply(ApiKeyMiddleware, TrustUserMiddleware).forRoutes('*');
    }
  }
}
