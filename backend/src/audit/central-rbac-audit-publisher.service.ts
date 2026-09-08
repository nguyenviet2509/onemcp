import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Fire-and-forget publisher: pushes OneMCP audit events to Central RBAC
// via POST /v1/audit/ingest. Central store is canonical for cross-app
// audit UI (rbacnb.000nethost.com → /audit). Local audit_events table
// remains as fallback so events aren't lost if central is unreachable.
//
// Config:
//   CENTRAL_RBAC_AUDIT_INGEST_URL  — full URL, e.g. https://rbacnb.000nethost.com/v1/audit/ingest
//   CENTRAL_RBAC_AUDIT_INGEST_TOKEN — bearer token registered in central's
//                                     AUDIT_INGEST_TOKENS as onemcp:<token>
// Empty URL disables publishing entirely (local-only fallback).

export interface CentralAuditPayload {
  action: string;
  target_type: string;
  target_id: string;
  actor_id?: string;
  actor_type?: 'user' | 'service';
  actor_email?: string;
  before_state?: unknown;
  after_state?: unknown;
  ip?: string;
  session_id?: string;
  correlation_id?: string;
}

@Injectable()
export class CentralRbacAuditPublisher {
  private readonly log = new Logger(CentralRbacAuditPublisher.name);
  private readonly url: string;
  private readonly token: string;
  private readonly enabled: boolean;
  private static readonly REQUEST_TIMEOUT_MS = 3_000;

  constructor(config: ConfigService) {
    this.url = config.get<string>('CENTRAL_RBAC_AUDIT_INGEST_URL', '').trim();
    this.token = config.get<string>('CENTRAL_RBAC_AUDIT_INGEST_TOKEN', '').trim();
    this.enabled = this.url.length > 0 && this.token.length > 0;
    if (!this.enabled) {
      this.log.warn('central audit publisher disabled (CENTRAL_RBAC_AUDIT_INGEST_URL/TOKEN empty)');
    } else {
      this.log.log(`central audit publisher enabled → ${this.url}`);
    }
  }

  // Fire-and-forget: never throws to caller. Errors logged with action tag.
  publish(payload: CentralAuditPayload): void {
    if (!this.enabled) return;
    void this.send(payload).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`central_audit_publish_fail action=${payload.action}: ${msg}`);
    });
  }

  private async send(payload: CentralAuditPayload): Promise<void> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CentralRbacAuditPublisher.REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
