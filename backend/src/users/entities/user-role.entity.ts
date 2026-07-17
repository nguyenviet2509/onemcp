import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, Column } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Department } from '../../departments/entities/department.entity';

// Multi-tenant: role được scope theo department.
// V1 pilot chỉ Kỹ thuật, nhưng cấu trúc sẵn cho multi-dept sau.
@Entity({ name: 'user_roles' })
@Unique(['userId', 'roleId', 'departmentId'])
export class UserRole {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (u) => u.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'role_id' })
  roleId!: number;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @Column({ name: 'department_id' })
  departmentId!: number;
}
