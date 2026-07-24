import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// ApiKey: per-user API key. key_hash = bcrypt(rawKey, cost=10). key_prefix indexed for O(1) lookup.
// Full key returned exactly once on create — never stored in plaintext. Matches migration 1720700000000.
@Entity({ name: 'api_keys' })
export class ApiKey {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'key_hash', type: 'text' })
  keyHash!: string;

  @Index({ unique: true })
  @Column({ name: 'key_prefix', type: 'varchar', length: 16 })
  keyPrefix!: string;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'bool', default: false })
  revoked!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
