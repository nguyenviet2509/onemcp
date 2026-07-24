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
  readonly runbookLoads: Counter<string>;
  // Phase 2B — Embedding pipeline counters.
  readonly embedEnqueued: Counter<string>;
  readonly embedCompleted: Counter<string>;
  readonly embedFailed: Counter<string>;
  // Phase 2C — Hybrid search mode counter.
  readonly searchModeUsed: Counter<string>;

  // Alertmanager webhook metrics (Phase 06).
  readonly alertsReceived: Counter<string>;
  readonly alertMatches: Counter<string>;
  readonly alertSlackFailures: Counter<string>;

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
    this.runbookLoads = new Counter({
      name: 'onemcp_runbook_loads_total',
      help: 'Runbook load events via MCP load_runbook tool',
      labelNames: ['name', 'service'],
      registers: [this.registry],
    });
    // Phase 06 — Alertmanager webhook.
    // Phase 2B — embedding pipeline.
    this.embedEnqueued = new Counter({
      name: 'onemcp_embed_enqueued_total',
      help: 'Embed jobs enqueued on artifact publish',
      registers: [this.registry],
    });
    this.embedCompleted = new Counter({
      name: 'onemcp_embed_completed_total',
      help: 'Embed jobs completed successfully',
      registers: [this.registry],
    });
    this.embedFailed = new Counter({
      name: 'onemcp_embed_failed_total',
      help: 'Embed jobs failed after all retries',
      labelNames: ['reason'],
      registers: [this.registry],
    });
    this.searchModeUsed = new Counter({
      name: 'onemcp_search_mode_used_total',
      help: 'Hybrid search calls by effective mode (hybrid|fts|semantic)',
      labelNames: ['mode'],
      registers: [this.registry],
    });

    this.alertsReceived = new Counter({
      name: 'onemcp_alerts_received_total',
      help: 'Alertmanager webhook alerts received (flag=enabled|disabled)',
      labelNames: ['flag'],
      registers: [this.registry],
    });
    this.alertMatches = new Counter({
      name: 'onemcp_alert_matches_total',
      help: 'Alertmanager KB/runbook search result posted to Slack (matched=true|false)',
      labelNames: ['alertname', 'matched'],
      registers: [this.registry],
    });
    this.alertSlackFailures = new Counter({
      name: 'onemcp_alert_slack_failures_total',
      help: 'Alertmanager Slack post failures per alertname',
      labelNames: ['alertname'],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    this.log.log('metrics registry ready — scrape at /metrics');
  }
}
