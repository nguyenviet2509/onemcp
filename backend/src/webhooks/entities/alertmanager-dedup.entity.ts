import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// Postgres-backed dedup table for Alertmanager alerts (RT-7).
// fingerprint = sha256(alertname + service + sorted-labels-json + startsAt) — server-computed.
// TTL: rows older than ALERTMANAGER_DEDUP_TTL_MIN (default 240 min / 4h) are pruned by cron.
// ix_alertmanager_dedup_ts index supports efficient pruning of old rows.
@Entity({ name: 'alertmanager_dedup' })
export class AlertmanagerDedup {
  // sha256 hex fingerprint — primary key, unique per alert identity window.
  @PrimaryColumn({ type: 'text' })
  fingerprint!: string;

  // Timestamp of first claim — used for TTL pruning.
  @Index('ix_alertmanager_dedup_ts')
  @CreateDateColumn({ name: 'ts', type: 'timestamptz' })
  ts!: Date;

  // Stored alertname for observability / debugging only.
  @Column({ name: 'alertname', type: 'text', nullable: true })
  alertname!: string | null;
}
