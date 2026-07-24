import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Space: workspace scoped to a department. Matches migration 1720700000000.
// visibility: 'space' | 'dept' | 'cross_dept' — controls artifact visibility inheritance.
@Entity({ name: 'spaces' })
export class Space {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ name: 'department_id', type: 'bigint', nullable: true })
  departmentId!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  icon!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'space' })
  visibility!: 'space' | 'dept' | 'cross_dept';

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
