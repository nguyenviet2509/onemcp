import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MinioService } from '../storage/minio.service';

// Liveness: process alive.
// Readiness: dependency reachability (Postgres, MinIO). Redis check optional (BullMQ
// tự retry, không cần block ready).
@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly minio: MinioService,
  ) {}

  @Get('health')
  liveness() {
    return {
      status: 'ok',
      service: 'onemcp-backend',
      mode: 'v1-trust-header',
      lockdown: process.env.EMERGENCY_LOCKDOWN === 'true',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async readiness() {
    if (process.env.EMERGENCY_LOCKDOWN === 'true') {
      throw new ServiceUnavailableException('OneMCP under emergency lockdown');
    }
    const checks = {
      postgres: false,
      minio: false,
    };

    try {
      await this.ds.query('SELECT 1');
      checks.postgres = true;
    } catch {
      // fall through
    }
    checks.minio = await this.minio.ping();

    const ok = checks.postgres && checks.minio;
    if (!ok) {
      throw new ServiceUnavailableException({ status: 'not-ready', checks });
    }
    return { status: 'ready', checks };
  }
}
