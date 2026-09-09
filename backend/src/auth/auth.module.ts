import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { SsoRevokeController } from './sso-revoke.controller';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';

// AuditModule là @Global → AuditLogService inject được không cần import.
// TypeOrmModule.forFeature: cần cho SsoRevokeController inject User + UserRole repositories
// (Central RBAC webhook `notify_app_revoke` gọi tới → xóa UserRole để mất role local).
@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole])],
  controllers: [AuthController, SsoRevokeController],
})
export class AuthModule {}
