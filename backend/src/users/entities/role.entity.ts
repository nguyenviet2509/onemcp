import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RoleCode = 'viewer' | 'contributor' | 'maintainer' | 'dept-admin' | 'super-admin';

@Entity({ name: 'roles' })
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code!: RoleCode;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description!: string | null;
}
