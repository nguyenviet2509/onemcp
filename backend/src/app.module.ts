import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';

// Root Nest module — v1 P1 scaffold.
// Feature modules (access, audit, users, departments) added in subsequent P1 steps.
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
        // Redact common secret-like keys defensively
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
