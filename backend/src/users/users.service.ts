import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { DepartmentsService } from '../departments/departments.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly depts: DepartmentsService,
  ) {}

  // V1 upsert by username — TrustUserMiddleware gọi mỗi request lần đầu.
  // Sau khi user đã tồn tại, chỉ SELECT (nhanh). Không update trên mọi request để giảm write load.
  async upsertByUsername(username: string): Promise<User> {
    const existing = await this.repo.findOne({ where: { username } });
    if (existing) return existing;

    const created = this.repo.create({
      username,
      departmentId: this.depts.getDefaultId(),
      status: 'active',
    });
    return this.repo.save(created);
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username } });
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }
}
