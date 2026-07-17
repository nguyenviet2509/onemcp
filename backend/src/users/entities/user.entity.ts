import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { UserRole } from './user-role.entity';

export type UserStatus = 'active' | 'disabled';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  // Username = trust header identity claim (v1). Populated by TrustUserMiddleware.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  username!: string;

  // Auth full integration (post-v1) will populate these.
  @Column({ type: 'varchar', length: 128, nullable: true })
  inetSub!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gitlabId!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  displayName!: string | null;

  @ManyToOne(() => Department, { nullable: false })
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @Column({ name: 'department_id' })
  departmentId!: number;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: UserStatus;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;

  @OneToMany(() => UserRole, (ur) => ur.user)
  userRoles!: UserRole[];
}
