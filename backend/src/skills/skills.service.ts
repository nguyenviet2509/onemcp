import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillLoadEvent } from './entities/skill-load-event.entity';
import { RequestUser } from '../common/user-request';

export interface SkillListFilter {
  tag?: string;
  q?: string;
}

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
    @InjectRepository(SkillLoadEvent) private readonly loadEvents: Repository<SkillLoadEvent>,
  ) {}

  // List skills user có thể xem — scope theo dept của user (multi-tenant ready).
  async list(user: RequestUser, filter: SkillListFilter = {}) {
    const qb = this.skills
      .createQueryBuilder('s')
      .where('s.department_id = :dept', { dept: user.departmentId })
      .andWhere("s.status <> 'archived'");

    if (filter.tag) {
      qb.andWhere(':tag = ANY(s.tags)', { tag: filter.tag });
    }
    if (filter.q) {
      qb.andWhere('(s.name ILIKE :q OR s.description ILIKE :q)', { q: `%${filter.q}%` });
    }
    return qb.orderBy('s.name', 'ASC').getMany();
  }

  async findByName(user: RequestUser, name: string): Promise<Skill> {
    const s = await this.skills.findOne({
      where: { departmentId: user.departmentId, name },
    });
    if (!s) throw new NotFoundException(`Skill "${name}" không tồn tại`);
    return s;
  }

  async listVersions(user: RequestUser, name: string): Promise<SkillVersion[]> {
    const s = await this.findByName(user, name);
    return this.versions.find({
      where: { skillId: s.id },
      order: { createdAt: 'DESC' },
    });
  }

  async findCurrentVersion(user: RequestUser, name: string): Promise<SkillVersion> {
    const s = await this.findByName(user, name);
    if (!s.currentVersionId) {
      throw new NotFoundException(`Skill "${name}" chưa có active version`);
    }
    const v = await this.versions.findOne({ where: { id: s.currentVersionId } });
    if (!v) throw new NotFoundException(`Version ${s.currentVersionId} không tồn tại`);
    return v;
  }

  // Ghi load event — gọi bởi MCP `load_skill` tool (P2 part 3).
  recordLoadEvent(params: {
    skillId: number;
    skillVersionId: number;
    user: RequestUser;
    ip?: string;
  }) {
    const row = this.loadEvents.create({
      skillId: params.skillId,
      skillVersionId: params.skillVersionId,
      userId: params.user.id,
      username: params.user.username,
      ip: params.ip ?? null,
    });
    return this.loadEvents.save(row);
  }
}
