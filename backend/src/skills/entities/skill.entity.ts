import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { SkillVersion } from './skill-version.entity';

export type SkillStatus = 'active' | 'deprecated' | 'archived';

// Skill = static content (SKILL.md + resources) — v1 KHÔNG execute code (C1 mitigation).
// Nguồn thật ở GitLab repo, metadata + version pointer lưu ở DB.
@Entity({ name: 'skills' })
@Unique(['departmentId', 'name'])
export class Skill {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @ManyToOne(() => Department, { nullable: false })
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @Column({ name: 'department_id' })
  departmentId!: number;

  @Column({ type: 'varchar', length: 500 })
  repoUrl!: string;

  @Column({ type: 'int', nullable: true })
  currentVersionId!: number | null;

  @Column({ type: 'int', nullable: true })
  ownerId!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: SkillStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  tags!: string[];

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;

  @OneToMany(() => SkillVersion, (v) => v.skill)
  versions!: SkillVersion[];
}
