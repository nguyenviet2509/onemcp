import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Append-only audit log. Never UPDATE/DELETE — only INSERT.
@Entity({ name: 'audit_events' })
@Index(['action', 'ts'])
@Index(['actorUsername', 'ts'])
export class AuditEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  // Nullable because actor có thể là system/anonymous request bị reject trước khi identify.
  @Column({ type: 'int', nullable: true })
  actorUserId!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  actorUsername!: string | null;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resourceType!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  after!: unknown;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sessionId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  ts!: Date;
}
