import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyMiddleware } from '../api-keys/api-key.middleware';
import { UsersModule } from '../users/users.module';
import { AdminCidrGuard } from './admin-cidr.guard';
import { IpCidrGuard } from './ip-cidr.guard';
import { RoleAssignerService } from './role-assigner.service';
import { TrustUserMiddleware } from './trust-user.middleware';

// Access module — v1 IP CIDR + trust header identity.
// APP_GUARD đăng ký IpCidrGuard global (chạy trước mọi guard khác).
// Middleware chain order (per phase-01 spec):
//   1. IpCidrGuard (APP_GUARD, runs first)
//   2. ApiKeyMiddleware (X-Onemcp-Key → set req.user, or fall through)
//   3. TrustUserMiddleware (X-Onemcp-User fallback)
@Global()
@Module({
  imports: [UsersModule, ApiKeysModule],
  providers: [
    RoleAssignerService,
    AdminCidrGuard,
    { provide: APP_GUARD, useClass: IpCidrGuard },
  ],
  exports: [RoleAssignerService, AdminCidrGuard],
})
export class AccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // ApiKeyMiddleware runs first: if X-Onemcp-Key present it sets req.user and calls next().
    // TrustUserMiddleware runs second: if req.user already set (by api-key), it skips header requirement.
    consumer.apply(ApiKeyMiddleware, TrustUserMiddleware).forRoutes('*');
  }
}
