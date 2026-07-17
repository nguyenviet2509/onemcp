import { Injectable, Logger } from '@nestjs/common';
import { SearchHit, SearchService } from '../search/search.service';
import { MetricsService } from '../metrics/metrics.service';
import { RoleCode } from '../users/entities/role.entity';
import { AlertmanagerDedupService } from './dedup.service';
import { SlackService } from './slack.service';
import { escapeSlackText } from './slack-escape.util';

// Alertname whitelist — reject labels that could abuse downstream systems (RT-6).
const ALERTNAME_RE = /^[A-Za-z0-9_-]+$/;

// Virtual system user for cross-dept search bypass (V2, RT-2).
// Username is regex-safe (no colons). 'system' is an extended role not in RoleCode union —
// cast needed so SearchService can check roles.includes('system') at runtime.
// departmentId = 0 is a sentinel (never matches a real dept) — bypassed via bypassDeptFilter.
const SYSTEM_USER = {
  id: 0,
  username: 'system-alertmanager',
  departmentId: 0,
  roles: ['system'] as unknown as RoleCode[],
  status: 'active' as const,
  claimedFromHeader: true as const,
};

export interface AlertmanagerPayload {
  alerts: AlertItem[];
  [key: string]: unknown;
}

export interface AlertItem {
  status: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  fingerprint?: string;
}

// Core handler for Alertmanager webhook payloads.
// Called asynchronously after 202 ACK is sent (RT-8).
@Injectable()
export class AlertmanagerService {
  private readonly log = new Logger(AlertmanagerService.name);

  constructor(
    private readonly search: SearchService,
    private readonly slack: SlackService,
    private readonly dedup: AlertmanagerDedupService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Handle a validated Alertmanager payload.
   * Called via setImmediate in controller — errors are caught + logged, never propagated.
   */
  async handle(payload: AlertmanagerPayload): Promise<void> {
    // Feature-flag gate (V8): silent no-op with metric when ops types disabled.
    if (process.env.ONEMCP_ENABLE_OPS_TYPES !== '1') {
      this.metrics.alertsReceived.inc({ flag: 'disabled' });
      return;
    }

    const ttlMin = this.resolveTtlMin();

    // Prune expired dedup rows opportunistically — non-blocking.
    this.dedup.prune(ttlMin).catch((e: unknown) =>
      this.log.warn(`dedup prune error: ${(e as Error).message}`),
    );

    // H6 fix: cap alerts per payload to prevent handler pileup on large batches.
    // Each alert can take up to ~5s (Slack timeout) — 20 alerts × 5s = 100s worst case per payload.
    const MAX_ALERTS_PER_PAYLOAD = 20;
    const alerts = payload.alerts.slice(0, MAX_ALERTS_PER_PAYLOAD);
    if (payload.alerts.length > MAX_ALERTS_PER_PAYLOAD) {
      this.log.warn(
        `payload had ${payload.alerts.length} alerts — processing first ${MAX_ALERTS_PER_PAYLOAD} only`,
      );
    }
    for (const alert of alerts) {
      await this.handleSingleAlert(alert, ttlMin);
    }
  }

  private async handleSingleAlert(alert: AlertItem, ttlMin: number): Promise<void> {
    // Only process firing alerts.
    if (alert.status !== 'firing') return;

    const alertname = alert.labels?.['alertname'] ?? '';

    // RT-6: whitelist alertname — reject if it contains unsafe chars.
    if (!ALERTNAME_RE.test(alertname)) {
      this.log.warn(`rejected alert with non-whitelisted alertname: "${alertname.slice(0, 60)}"`);
      return;
    }

    this.metrics.alertsReceived.inc({ flag: 'enabled' });

    // Compute server-side fingerprint — never trust client-supplied groupKey (RT-7).
    const fp = AlertmanagerDedupService.fingerprint(alert);
    const isFirst = await this.dedup.claim(fp, alertname);
    if (!isFirst) {
      this.log.debug(`dedup hit — skipping duplicate alert fingerprint=${fp.slice(0, 16)}...`);
      return;
    }

    const service = alert.labels?.['service'] ?? undefined;
    const severity = alert.labels?.['severity'] ?? '';
    const summary = alert.annotations?.['summary'] ?? '';

    // Build search query from alert metadata.
    const q = [alertname, service, summary]
      .filter(Boolean)
      .join(' ')
      .slice(0, 500); // cap to avoid absurdly long queries

    let hits: SearchHit[] = [];
    try {
      hits = await this.search.search(SYSTEM_USER, {
        q,
        service: service ?? null,
        bypassDeptFilter: true,
        limit: 3,
      });
    } catch (err) {
      // Search failure must not prevent Slack notification (RT-8 / fallback).
      this.log.error(`search_failed for alert="${alertname}": ${(err as Error).message}`);
    }

    const msg = this.formatMessage(alertname, severity, service ?? '', summary, hits);

    try {
      await this.slack.post(msg);
      // H1 fix: dedup is claim-then-release-on-failure (RT-7).
      // We already claimed above (line 92) so no re-insert here — Slack success keeps the claim.
      this.metrics.alertMatches.inc({
        alertname,
        matched: hits.length > 0 ? 'true' : 'false',
      });
    } catch (err) {
      this.log.error(`slack_post_failed for alert="${alertname}": ${(err as Error).message}`);
      this.metrics.alertSlackFailures.inc({ alertname });
      // Release dedup so next Alertmanager retry can re-attempt Slack delivery.
      await this.dedup.release(fp).catch(() => undefined);
    }
  }

  /**
   * Format a Slack mrkdwn message. All interpolated strings are escaped (RT-6).
   */
  private formatMessage(
    alertname: string,
    severity: string,
    service: string,
    summary: string,
    hits: SearchHit[],
  ): string {
    const safeAlertname = escapeSlackText(alertname);
    const safeSeverity = escapeSlackText(severity);
    const safeService = escapeSlackText(service);
    const safeSummary = escapeSlackText(summary);

    const portalBase = (process.env.PUBLIC_API_URL ?? 'http://localhost/api')
      .replace(/\/api\/?$/, '');

    let lines = [
      `🚨 Alert: ${safeAlertname} (${safeSeverity})`,
      `Service: ${safeService}`,
      `Summary: ${safeSummary}`,
      '',
    ];

    if (hits.length === 0) {
      lines.push(
        '📚 OneMCP: Không tìm thấy runbook/KB liên quan. Cân nhắc tạo runbook mới sau khi giải quyết.',
      );
    } else {
      lines.push('📚 Related runbooks/KBs từ OneMCP:');
      hits.forEach((h, i) => {
        const kind = (h.meta?.['type'] as string) ?? h.kind;
        const safeTitle = escapeSlackText(h.name);
        const url = `${portalBase}/artifacts/${h.id}`;
        lines.push(`${i + 1}. [${escapeSlackText(kind)}] ${safeTitle} — ${url}`);
      });
    }

    return lines.join('\n');
  }

  private resolveTtlMin(): number {
    const raw = process.env.ALERTMANAGER_DEDUP_TTL_MIN;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 240;
  }
}
