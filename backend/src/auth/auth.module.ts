import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

// AuditModule là @Global → AuditLogService inject được không cần import.
@Module({
  controllers: [AuthController],
})
export class AuthModule {}
