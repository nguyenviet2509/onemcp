import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { RequestUser } from '../common/user-request';
import { MetricsService } from '../metrics/metrics.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillLoadEvent } from './entities/skill-load-event.entity';

export interface SkillListFilter {
  tag?: string;
  q?: string;
  projectId?: number;
}

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
    @InjectRepository(SkillLoadEvent) private readonly loadEvents: Repository<SkillLoadEvent>,
    private readonly metrics: MetricsService,
  ) {}

  // List skills user có thể xem — RBAC × project scope filter (P10).
  //   Legacy (projectId=null): dept-scoped by skill.department_id
  //   Multi (projectId set):    project.scope drives visibility
  //     - public: anyone authenticated
  //     - dept:   same department OR admin
  //     - private: owner OR admin
  async list(user: RequestUser, filter: SkillListFilter = {}) {
    const isAdmin = user.roles.some((r) => r === 'super-admin' || r === 'dept-admin');

    const qb = this.skills
      .createQueryBuilder('s')
      .leftJoin('projects', 'p', 'p.id = s.project_id')
      .andWhere("s.status <> 'archived'");

    if (isAdmin) {
      // Admin sees all non-archived. No further scope filter.
    } else {
      qb.andWhere(
        `(
          (s.project_id IS NULL AND s.department_id = :dept)
          OR (p.scope = 'public')
          OR (p.scope = 'dept' AND p.department_id = :dept)
          OR (p.scope = 'private' AND p.owner_id = :uid)
        )`,
        { dept: user.departmentId, uid: user.id },
      );
    }

    if (filter.tag) {
      qb.andWhere(':tag = ANY(s.tags)', { tag: filter.tag });
    }
    if (filter.q) {
      qb.andWhere('(s.name ILIKE :q OR s.description ILIKE :q)', { q: `%${filter.q}%` });
    }
    if (filter.projectId !== undefined) {
      qb.andWhere('s.project_id = :pid', { pid: filter.projectId });
    }
    const skills = await qb.orderBy('s.name', 'ASC').getMany();

    // Attach project slug/name so portal can display + filter without a second round-trip.
    const projectIds = Array.from(
      new Set(skills.map((s) => s.projectId).filter((v): v is number => !!v)),
    );
    const projectMap = new Map<number, { slug: string; name: string }>();
    if (projectIds.length > 0) {
      const rows = await this.skills.manager.query<{ id: number; slug: string; name: string }[]>(
        `SELECT id, slug, name FROM projects WHERE id = ANY($1::int[])`,
        [projectIds],
      );
      for (const r of rows) projectMap.set(r.id, { slug: r.slug, name: r.name });
    }
    return skills.map((s) => ({
      ...s,
      projectSlug: s.projectId ? projectMap.get(s.projectId)?.slug ?? null : null,
      projectName: s.projectId ? projectMap.get(s.projectId)?.name ?? null : null,
    }));
  }

  async findByName(user: RequestUser, name: string): Promise<Skill> {
    // Exclude archived — archived skills must not be loadable via MCP `load_skill`.
    // Deprecated remains loadable (upstream can warn but still fetch).
    const s = await this.skills.findOne({
      where: { departmentId: user.departmentId, name, status: Not('archived') },
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
    skillName: string;
    skillId: number;
    skillVersionId: number;
    user: RequestUser;
    ip?: string;
  }) {
    this.metrics.skillLoads.inc({ skill: params.skillName });
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
