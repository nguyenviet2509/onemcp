import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

// AlertmanagerDedupService — Postgres-backed dedup for Alertmanager alerts (RT-7).
//
// Fingerprint = sha256(alertname + service + JSON.stringify(sortedLabels) + startsAt)
// Computed SERVER-SIDE — never trusts client-supplied groupKey.
//
// claim(): INSERT ... ON CONFLICT DO NOTHING → returns true (first seen) or false (duplicate).
// release(): DELETE fingerprint — used when Slack POST fails so retry can re-claim.
// prune(): DELETE rows older than TTL — called periodically (or on each request in low-volume).
@Injectable()
export class AlertmanagerDedupService {
  private readonly log = new Logger(AlertmanagerDedupService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Compute a server-side fingerprint for an alert.
   * Labels are sorted to ensure stable ordering regardless of Alertmanager label map order.
   */
  static fingerprint(alert: {
    labels?: Record<string, string>;
    startsAt?: string;
  }): string {
    const labels = alert.labels ?? {};
    const alertname = labels['alertname'] ?? '';
    const service = labels['service'] ?? '';
    const startsAt = alert.startsAt ?? '';

    // Sort label entries for deterministic JSON.
    const sortedLabels = Object.fromEntries(
      Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)),
    );

    const raw = alertname + '|' + service + '|' + JSON.stringify(sortedLabels) + '|' + startsAt;
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Attempt to claim a fingerprint. Returns true if this is the FIRST time we've seen
   * this fingerprint (i.e., the row was inserted). Returns false if it already exists.
   * Uses INSERT ... ON CONFLICT DO NOTHING so concurrent requests are safe.
   */
  async claim(fingerprint: string, alertname?: string): Promise<boolean> {
    const result = await this.ds.query<{ inserted: string }[]>(
      `INSERT INTO alertmanager_dedup (fingerprint, alertname)
       VALUES ($1, $2)
       ON CONFLICT (fingerprint) DO NOTHING
       RETURNING 'yes' AS inserted`,
      [fingerprint, alertname ?? null],
    );
    return result.length > 0;
  }

  /**
   * Release a fingerprint claim — used when the downstream (Slack) fails so
   * the next Alertmanager retry can re-claim it and attempt delivery again.
   */
  async release(fingerprint: string): Promise<void> {
    await this.ds.query(`DELETE FROM alertmanager_dedup WHERE fingerprint = $1`, [fingerprint]);
  }

  /**
   * Prune rows older than ttlMinutes. Call once per webhook request or on a schedule.
   * Keeps the table small without needing a separate cron job at low volume.
   */
  async prune(ttlMinutes: number): Promise<void> {
    try {
      const result = await this.ds.query<{ count: string }[]>(
        `DELETE FROM alertmanager_dedup
         WHERE ts < now() - ($1 || ' minutes')::interval
         RETURNING fingerprint`,
        [String(ttlMinutes)],
      );
      if (result.length > 0) {
        this.log.debug(`dedup pruned ${result.length} expired rows (ttl=${ttlMinutes}min)`);
      }
    } catch (err) {
      // Prune failure is non-critical — log and continue.
      this.log.warn(`dedup prune failed: ${(err as Error).message}`);
    }
  }
}
