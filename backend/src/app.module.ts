import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AccessModule } from './access/access.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './audit/audit.module';
import { dataSourceOptions } from './db/data-source';
import { DepartmentsModule } from './departments/departments.module';
import { HealthModule } from './health/health.module';
import { McpModule } from './mcp/mcp.module';
import { MetricsModule } from './metrics/metrics.module';
import { SearchModule } from './search/search.module';
import { SkillsModule } from './skills/skills.module';
import { SpacesModule } from './spaces/spaces.module';
import { StorageModule } from './storage/storage.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-onemcp-user"]'],
      },
    }),
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: false }),
    // BullMQ shared Redis config — parsed from REDIS_URL.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = new URL(cfg.get<string>('REDIS_URL', 'redis://redis:6379'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    HealthModule,
    DepartmentsModule,
    UsersModule,
    AccessModule,
    AuditModule,
    MetricsModule,
    StorageModule,
    SkillsModule,
    SpacesModule,
    TemplatesModule,
    ApiKeysModule,
    ArtifactsModule,
    AttachmentsModule,
    EmbeddingsModule,
    SearchModule,
    WebhooksModule,
    McpModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
