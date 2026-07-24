import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ArtifactStatus, ArtifactType } from '../artifact-type.enum';

// Artifact: report/research/KB. Unique per (dept, slug). current_version_id trỏ tới
// artifact_versions.id — chỉ set khi maintainer approve (status='published').
// Phase 1C: added space_id, template_key, visibility, view_count, last_viewed_at.
// Dual-read: type column kept for 1 release for backward compat; prefer template_key.
@Entity({ name: 'artifacts' })
@Unique(['departmentId', 'slug'])
export class Artifact {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  // DEPRECATED: use template_key. Kept for dual-read during 1-release migration window.
  @Index()
  @Column({ type: 'varchar', length: 16 })
  type!: ArtifactType;

  // Phase 1C: preferred key referencing templates table. Null during migration backfill window.
  @Index()
  @Column({ name: 'template_key', type: 'varchar', length: 64, nullable: true })
  templateKey!: string | null;

  // Phase 1C: space this artifact belongs to. Null during migration backfill window.
  @Index()
  @Column({ name: 'space_id', type: 'bigint', nullable: true })
  spaceId!: string | null;

  // Phase 1C: visibility level. Defaults to 'space'.
  @Column({ type: 'varchar', length: 16, default: 'space' })
  visibility!: string;

  // Phase 1C: view counter incremented on load_runbook + get_artifact.
  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount!: number;

  // Phase 1C: timestamp of last viewed event.
  @Column({ name: 'last_viewed_at', type: 'timestamptz', nullable: true })
  lastViewedAt!: Date | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  slug!: string;

  @Column({ name: 'department_id' })
  departmentId!: number;

  @Column({ name: 'owner_id' })
  ownerId!: number;

  @Column({ name: 'current_version_id', type: 'bigint', nullable: true })
  currentVersionId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ArtifactStatus;

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  tags!: string[];

  // Populated khi type=runbook từ template field 'service' (V1 — dedicated column + btree index).
  @Index()
  @Column({ type: 'text', nullable: true })
  service!: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
