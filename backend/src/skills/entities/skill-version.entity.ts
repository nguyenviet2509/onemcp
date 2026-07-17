import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Skill } from './skill.entity';

export type SkillVersionStatus = 'pending' | 'active' | 'rejected';

// Version tương ứng commit trong repo skill. Upsert bởi skill-sync worker sau khi maintainer approve MR.
@Entity({ name: 'skill_versions' })
@Unique(['skillId', 'commitSha'])
export class SkillVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Skill, (s) => s.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill!: Skill;

  @Column({ name: 'skill_id' })
  skillId!: number;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  commitSha!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  version!: string | null;

  @Column({ type: 'jsonb' })
  manifest!: Record<string, unknown>;

  // SKILL.md content — populated bởi skill-sync worker. NULL nếu chưa sync.
  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'int', nullable: true })
  approvedBy!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: SkillVersionStatus;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
