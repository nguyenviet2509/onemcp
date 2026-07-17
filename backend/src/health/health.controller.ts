import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

// Minimal health + readiness probes.
// Full checks (Postgres/Redis/MinIO reachability) added when those modules land.
@Controller()
export class HealthController {
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
  readiness() {
    // Placeholder — will check Postgres/Redis/MinIO in later P1 steps.
    if (process.env.EMERGENCY_LOCKDOWN === 'true') {
      throw new ServiceUnavailableException('OneMCP under emergency lockdown');
    }
    return { status: 'ready' };
  }
}
