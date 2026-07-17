import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

// Prometheus metrics registry. Default Node metrics + app-specific counters/histograms.
// Expose qua /metrics endpoint. Scrape từ Prometheus.
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly log = new Logger(MetricsService.name);
  readonly registry = new Registry();

  readonly httpRequests: Counter<string>;
  readonly httpDuration: Histogram<string>;
  readonly artifactSubmits: Counter<string>;
  readonly skillLoads: Counter<string>;
  readonly mcpCalls: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'onemcp_' });

    this.httpRequests = new Counter({
      name: 'onemcp_http_requests_total',
      help: 'HTTP request count',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.httpDuration = new Histogram({
      name: 'onemcp_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 1, 3, 10],
      registers: [this.registry],
    });
    this.artifactSubmits = new Counter({
      name: 'onemcp_artifact_submits_total',
      help: 'Artifact submits per type',
      labelNames: ['type', 'result'],
      registers: [this.registry],
    });
    this.skillLoads = new Counter({
      name: 'onemcp_skill_loads_total',
      help: 'Skill load events per skill',
      labelNames: ['skill'],
      registers: [this.registry],
    });
    this.mcpCalls = new Counter({
      name: 'onemcp_mcp_tool_calls_total',
      help: 'MCP tool call count',
      labelNames: ['tool', 'result'],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    this.log.log('metrics registry ready — scrape at /metrics');
  }
}
