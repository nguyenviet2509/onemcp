import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ArtifactStatus, ArtifactType } from '../artifact-type.enum';

// Artifact: report/research/KB. Unique per (dept, slug). current_version_id trỏ tới
// artifact_versions.id — chỉ set khi maintainer approve (status='published').
@Entity({ name: 'artifacts' })
@Unique(['departmentId', 'slug'])
export class Artifact {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  type!: ArtifactType;

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
