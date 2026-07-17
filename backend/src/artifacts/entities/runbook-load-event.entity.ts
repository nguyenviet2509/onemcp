import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Artifact } from './artifact.entity';
import { ArtifactVersion } from './artifact-version.entity';

// Audit log cho mỗi lần MCP load_runbook gọi — dùng cho analytics + daily digest (Phase sau).
// IP lưu dạng sha256(ip + salt) để tránh PII (RT-15). Nếu RUNBOOK_EVENTS_IP_SALT rỗng → ip_hash = null.
@Entity({ name: 'runbook_load_events' })
@Index(['artifactId', 'ts'])
@Index(['ts']) // Dùng cho prune cron query.
export class RunbookLoadEvent {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @ManyToOne(() => Artifact, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'artifact_id' })
  artifact!: Artifact | null;

  @Column({ name: 'artifact_id', type: 'bigint', nullable: true })
  artifactId!: string | null;

  @ManyToOne(() => ArtifactVersion, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'artifact_version_id' })
  artifactVersion!: ArtifactVersion | null;

  @Column({ name: 'artifact_version_id', type: 'bigint', nullable: true })
  artifactVersionId!: string | null;

  // user_id dạng text để tương thích cả numeric và string identity.
  @Column({ name: 'user_id', type: 'text', nullable: true })
  userId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  ts!: Date;

  // sha256(ip + RUNBOOK_EVENTS_IP_SALT) hoặc null nếu salt chưa cấu hình (RT-15).
  @Column({ name: 'ip_hash', type: 'text', nullable: true })
  ipHash!: string | null;
}
