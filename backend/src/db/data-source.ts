import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Department } from '../departments/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { AuditEvent } from '../audit/entities/audit-event.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.POSTGRES_URL,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [Department, User, Role, UserRole, AuditEvent],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsRun: false,
};

// Named export needed for typeorm CLI (`typeorm -d src/db/data-source.ts`).
export default new DataSource(dataSourceOptions);
