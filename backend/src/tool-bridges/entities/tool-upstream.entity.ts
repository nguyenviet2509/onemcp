import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Upstream HTTP API registered for tool bridging.
// bearer_ciphertext: AES-256-GCM via TokenCipherService — never plaintext.
// Soft-disable via enabled flag; no hard-delete to preserve audit history.
@Entity({ name: 'tool_upstreams' })
export class ToolUpstream {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  name!: string;

  @Column({ name: 'base_url', type: 'varchar', length: 512 })
  baseUrl!: string;

  @Column({ name: 'bearer_ciphertext', type: 'text' })
  bearerCiphertext!: string;

  @Column({ name: 'timeout_ms', type: 'int', default: 10000 })
  timeoutMs!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
