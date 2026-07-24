import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Saved search: user-pinned query + filter combo. User-scoped — no cross-user access.
// filters JSONB holds optional space_id, template_key, tags[], dept, etc.
// ON DELETE CASCADE handled in migration via FK constraint on users(id).
@Entity({ name: 'saved_searches' })
export class SavedSearch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  query!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  filters!: {
    spaceId?: string;
    templateKey?: string;
    tags?: string[];
    dept?: string;
  };

  @Column({ type: 'varchar', length: 16, default: 'hybrid' })
  mode!: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
