import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ArtifactVersionStatus } from '../artifact-type.enum';

// Immutable snapshot của artifact tại 1 thời điểm submit. Append-only.
// Review data (reviewed_by/at/note) embed để tránh join thêm bảng khi query detail.
@Entity({ name: 'artifact_versions' })
@Unique(['artifactId', 'versionNo'])
export class ArtifactVersion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'artifact_id', type: 'bigint' })
  artifactId!: string;

  @Column({ name: 'version_no' })
  versionNo!: number;

  @Column({ name: 'author_id' })
  authorId!: number;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  structured!: Record<string, unknown>;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ArtifactVersionStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt!: Date;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy!: number | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;
}
