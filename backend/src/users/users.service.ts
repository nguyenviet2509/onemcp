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

  // Idempotent upsert by email — used by bridge auto-provision endpoint.
  // Derives username from email local-part: lowercase, strip non-[a-z0-9._-].
  // Validates @inet.vn domain at service boundary (caller also validates, defence in depth).
  async ensureByEmail(email: string): Promise<{ username: string; role: string; created: boolean }> {
    const lower = email.trim().toLowerCase();
    if (!lower.endsWith('@inet.vn')) {
      throw new Error('ensureByEmail: only @inet.vn emails accepted');
    }
    const localPart = lower.split('@')[0];
    const username = localPart.replace(/[^a-z0-9._-]/g, '');
    if (!username) {
      throw new Error(`ensureByEmail: derived username empty for email=${email}`);
    }

    const existing = await this.repo.findOne({ where: { username } });
    if (existing) {
      return { username: existing.username, role: 'contributor', created: false };
    }

    const created = this.repo.create({
      username,
      email: lower,
      departmentId: this.depts.getDefaultId(),
      status: 'active',
    });
    await this.repo.save(created);
    return { username, role: 'contributor', created: true };
  }
}
