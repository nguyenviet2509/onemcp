import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyMiddleware } from '../api-keys/api-key.middleware';
import { OAuthModule } from '../oauth/oauth.module';
import { BearerAuthMiddleware } from '../oauth/bearer-auth.middleware';
import { UsersModule } from '../users/users.module';
import { AdminCidrGuard } from './admin-cidr.guard';
import { IpCidrGuard } from './ip-cidr.guard';
import { RoleAssignerService } from './role-assigner.service';
import { TrustUserMiddleware } from './trust-user.middleware';

// Access module — identity chain.
// APP_GUARD đăng ký IpCidrGuard global (chạy trước mọi guard khác).
// Middleware chain order:
//   1. IpCidrGuard (APP_GUARD, runs first)
//   2. ApiKeyMiddleware       — X-Onemcp-Key
//   3. BearerAuthMiddleware   — Authorization: Bearer (OAuth 2.1 opaque token)
//   4. TrustUserMiddleware    — X-Onemcp-User (session header, legacy fallback)
@Global()
@Module({
  imports: [UsersModule, ApiKeysModule, OAuthModule],
  providers: [
    RoleAssignerService,
    AdminCidrGuard,
    { provide: APP_GUARD, useClass: IpCidrGuard },
  ],
  exports: [RoleAssignerService, AdminCidrGuard],
})
export class AccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiKeyMiddleware, BearerAuthMiddleware, TrustUserMiddleware).forRoutes('*');
  }
}
