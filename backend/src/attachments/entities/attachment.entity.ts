import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'attachments' })
@Unique(['storageKey'])
export class Attachment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ name: 'artifact_id', type: 'bigint' })
  artifactId!: string;

  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 128 })
  contentType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'checksum_sha256', type: 'varchar', length: 64 })
  checksumSha256!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ name: 'uploaded_by' })
  uploadedBy!: number;

  @Column({ name: 'uploaded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt!: Date;
}
