import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { dataSourceOptions } from './db/data-source';
import { AccessModule } from './access/access.module';
import { AuditModule } from './audit/audit.module';
import { DepartmentsModule } from './departments/departments.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';

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
    HealthModule,
    DepartmentsModule,
    UsersModule,
    AccessModule,
    AuditModule,
  ],
})
export class AppModule {}
