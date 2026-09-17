import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ToolUpstream } from './tool-upstream.entity';

// Bridge config: maps a named tool to an upstream endpoint + JSON schema for params.
// permission_id: Central RBAC permission required to invoke this bridge (checked at P2).
// param_schema: JSON Schema (JSONB) — meta-validated on write via ParamSchemaValidator.
@Entity({ name: 'tool_bridges' })
export class ToolBridge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'upstream_id', type: 'uuid' })
  upstreamId!: string;

  @ManyToOne(() => ToolUpstream, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'upstream_id' })
  upstream!: ToolUpstream;

  @Column({ type: 'varchar', length: 64, unique: true })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 8 })
  method!: 'GET' | 'POST' | 'PUT' | 'DELETE';

  @Column({ type: 'varchar', length: 512 })
  path!: string;

  @Column({ name: 'param_schema', type: 'jsonb' })
  paramSchema!: Record<string, unknown>;

  @Column({ name: 'permission_id', type: 'varchar', length: 128 })
  permissionId!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
