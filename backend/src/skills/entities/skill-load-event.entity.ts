import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Skill } from './skill.entity';
import { SkillVersion } from './skill-version.entity';

// Log mọi lần MCP client gọi load_skill — dùng cho audit + analytics (top skills).
@Entity({ name: 'skill_load_events' })
@Index(['skillId', 'ts'])
export class SkillLoadEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill!: Skill;

  @Column({ name: 'skill_id' })
  skillId!: number;

  @ManyToOne(() => SkillVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_version_id' })
  version!: SkillVersion;

  @Column({ name: 'skill_version_id' })
  skillVersionId!: number;

  @Column({ type: 'int', nullable: true })
  userId!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  ts!: Date;
}
