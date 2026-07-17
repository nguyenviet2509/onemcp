import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

// /metrics — Prometheus scrape endpoint. Không auth (bypass CIDR guard needed).
// Nginx nên IP-restrict path này ở prod.
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
