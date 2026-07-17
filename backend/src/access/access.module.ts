import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AdminCidrGuard } from './admin-cidr.guard';
import { IpCidrGuard } from './ip-cidr.guard';
import { RoleAssignerService } from './role-assigner.service';
import { TrustUserMiddleware } from './trust-user.middleware';

// Access module — v1 IP CIDR + trust header identity.
// APP_GUARD đăng ký IpCidrGuard global (chạy trước mọi guard khác).
// TrustUserMiddleware chạy trên tất cả routes (đăng ký ở configure()).
@Global()
@Module({
  imports: [UsersModule],
  providers: [
    RoleAssignerService,
    AdminCidrGuard,
    { provide: APP_GUARD, useClass: IpCidrGuard },
  ],
  exports: [RoleAssignerService, AdminCidrGuard],
})
export class AccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TrustUserMiddleware).forRoutes('*');
  }
}
