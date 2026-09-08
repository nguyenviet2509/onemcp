import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit-log.service';
import { AuditQueryService } from './audit-query.service';
import { AuditRetentionService } from './audit-retention.service';
import { AuditInterceptor } from './audit.interceptor';
import { CentralRbacAuditPublisher } from './central-rbac-audit-publisher.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditController],
  providers: [
    CentralRbacAuditPublisher,
    AuditLogService,
    AuditQueryService,
    AuditRetentionService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
