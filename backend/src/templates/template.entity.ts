import { Column, Entity, Index } from 'typeorm';

// Template: DB-driven registry replacing hardcoded template-registry.ts.
// key is PK (e.g. 'report', 'kb', 'runbook', 'sop', 'faq'). Matches migration 1720700000000.
// department_scope: empty array = visible to all departments.
@Entity({ name: 'templates' })
export class Template {
  @Column({ type: 'varchar', length: 64, primary: true })
  key!: string;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  schema!: Record<string, unknown>;

  @Column({ name: 'ui_hints', type: 'jsonb', nullable: true })
  uiHints!: Record<string, unknown> | null;

  @Column({ name: 'department_scope', type: 'text', array: true, default: () => "'{}'::text[]" })
  departmentScope!: string[];

  @Index()
  @Column({ type: 'bool', default: true })
  active!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
