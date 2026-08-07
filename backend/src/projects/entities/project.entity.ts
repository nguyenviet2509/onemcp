import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { User } from '../../users/entities/user.entity';

export type ProjectScope = 'public' | 'dept' | 'private';
export type ProjectStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'suspended';

// Project = git repo hosting skills. Multi-project registry (P4).
// Legacy skills-kythuat = implicit project (projectId=null on skills table).
@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'git_repo_url', type: 'varchar', length: 500 })
  gitRepoUrl!: string;

  // AES-256-GCM encrypted deploy token. Format: iv:ciphertext:tag (base64 segments joined by ':').
  // Null until a deploy token is issued. Boot guard: prod refuses start if ONEMCP_ENCRYPTION_KEY absent.
  @Column({ name: 'deploy_token_enc', type: 'bytea', nullable: true })
  deployTokenCiphertext!: Buffer | null;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'private' })
  scope!: ProjectScope;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department!: Department | null;

  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId!: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner!: User | null;

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId!: number | null;

  // Random 32-byte hex, unique per project, used for HMAC webhook verification.
  @Index({ unique: true })
  @Column({ name: 'webhook_secret', type: 'varchar', length: 128 })
  webhookSecret!: string;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ProjectStatus;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy!: User | null;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approvedById!: number | null;

  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
