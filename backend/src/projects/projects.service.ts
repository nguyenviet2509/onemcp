import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service';
import { TokenCipherService } from '../common/crypto/token-cipher.service';
import { RequestUser } from '../common/user-request';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project, ProjectStatus } from './entities/project.entity';

// Project registry service (P6). Owns state machine:
//   pending → approved | rejected
//   approved → active   (set by first successful sync in P9)
//   active → suspended  (admin manual)
// rejected is terminal (delete + recreate to retry).
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
    private readonly audit: AuditLogService,
    private readonly cipher: TokenCipherService,
  ) {}

  // Encrypt + store GitLab deploy token so worker can clone private repos.
  // Passing empty string clears the stored token.
  async setDeployToken(id: number, user: RequestUser, token: string): Promise<Project> {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (!this.isAdmin(user) && p.ownerId !== user.id) {
      throw new ForbiddenException('Only owner or admin can set deploy token');
    }
    const trimmed = token.trim();
    if (trimmed) {
      const ciphertext = this.cipher.encrypt(trimmed);
      p.deployTokenCiphertext = Buffer.from(ciphertext, 'utf8');
    } else {
      p.deployTokenCiphertext = null;
    }
    p.updatedAt = new Date();
    const saved = await this.repo.save(p);
    this.audit.record({
      actor: user,
      action: trimmed ? 'project.deploy_token_set' : 'project.deploy_token_cleared',
      resourceType: 'project',
      resourceId: id,
    });
    return saved;
  }

  private isAdmin(user: RequestUser): boolean {
    return user.roles.some((r) => r === 'super-admin' || r === 'dept-admin');
  }

  private newWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }

  async register(dto: CreateProjectDto, owner: RequestUser): Promise<{ project: Project; webhookSecret: string }> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Project slug '${dto.slug}' already exists`);
    }
    const webhookSecret = this.newWebhookSecret();
    const entity = this.repo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      gitRepoUrl: dto.gitRepoUrl,
      scope: dto.scope ?? 'private',
      departmentId: owner.departmentId || null,
      ownerId: owner.id,
      webhookSecret,
      status: 'pending' as ProjectStatus,
    });
    const saved = await this.repo.save(entity);
    this.audit.record({
      actor: owner,
      action: 'project.registered',
      resourceType: 'project',
      resourceId: saved.id,
      after: { slug: saved.slug, gitRepoUrl: saved.gitRepoUrl, scope: saved.scope },
    });
    return { project: saved, webhookSecret };
  }

  async list(user: RequestUser): Promise<Project[]> {
    if (this.isAdmin(user)) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.find({ where: { ownerId: user.id }, order: { createdAt: 'DESC' } });
  }

  async detail(id: number, user: RequestUser): Promise<Project> {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (!this.isAdmin(user) && p.ownerId !== user.id) {
      throw new ForbiddenException('Not owner of this project');
    }
    return p;
  }

  async approve(id: number, admin: RequestUser): Promise<Project> {
    if (!this.isAdmin(admin)) throw new ForbiddenException('Admin only');
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (p.status !== 'pending') {
      throw new ConflictException(`Cannot approve from status '${p.status}' (only 'pending')`);
    }
    p.status = 'approved';
    p.approvedAt = new Date();
    p.approvedById = admin.id;
    p.updatedAt = new Date();
    const saved = await this.repo.save(p);
    this.audit.record({ actor: admin, action: 'project.approved', resourceType: 'project', resourceId: id });
    return saved;
  }

  async reject(id: number, admin: RequestUser, reason?: string): Promise<Project> {
    if (!this.isAdmin(admin)) throw new ForbiddenException('Admin only');
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (p.status !== 'pending') {
      throw new ConflictException(`Cannot reject from status '${p.status}' (only 'pending')`);
    }
    p.status = 'rejected';
    p.rejectedReason = reason ?? null;
    p.updatedAt = new Date();
    const saved = await this.repo.save(p);
    this.audit.record({ actor: admin, action: 'project.rejected', resourceType: 'project', resourceId: id, after: { reason } });
    return saved;
  }

  async suspend(id: number, admin: RequestUser): Promise<Project> {
    if (!this.isAdmin(admin)) throw new ForbiddenException('Admin only');
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (p.status !== 'active' && p.status !== 'approved') {
      throw new ConflictException(`Cannot suspend from status '${p.status}' (only 'active'/'approved')`);
    }
    p.status = 'suspended';
    p.updatedAt = new Date();
    const saved = await this.repo.save(p);
    this.audit.record({ actor: admin, action: 'project.suspended', resourceType: 'project', resourceId: id });
    return saved;
  }

  async regenerateSecret(id: number, user: RequestUser): Promise<{ project: Project; webhookSecret: string }> {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (!this.isAdmin(user) && p.ownerId !== user.id) {
      throw new ForbiddenException('Only owner or admin can regenerate secret');
    }
    const webhookSecret = this.newWebhookSecret();
    p.webhookSecret = webhookSecret;
    p.updatedAt = new Date();
    await this.repo.save(p);
    this.audit.record({ actor: user, action: 'project.secret_rotated', resourceType: 'project', resourceId: id });
    return { project: p, webhookSecret };
  }

  async resume(id: number, admin: RequestUser): Promise<Project> {
    if (!this.isAdmin(admin)) throw new ForbiddenException('Admin only');
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (p.status !== 'suspended') {
      throw new ConflictException(`Cannot resume from status '${p.status}' (only 'suspended')`);
    }
    // Back to 'approved' — next successful sync will flip to 'active' via markActive().
    p.status = 'approved';
    p.updatedAt = new Date();
    const saved = await this.repo.save(p);
    this.audit.record({ actor: admin, action: 'project.resumed', resourceType: 'project', resourceId: id });
    return saved;
  }

  async update(
    id: number,
    user: RequestUser,
    patch: { name?: string; description?: string; gitRepoUrl?: string; scope?: ProjectStatus | 'public' | 'dept' | 'private' },
  ): Promise<Project> {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    if (!this.isAdmin(user) && p.ownerId !== user.id) {
      throw new ForbiddenException('Only owner or admin can edit');
    }
    const before = { name: p.name, description: p.description, gitRepoUrl: p.gitRepoUrl, scope: p.scope };
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.description !== undefined) p.description = patch.description || null;
    if (patch.gitRepoUrl !== undefined) p.gitRepoUrl = patch.gitRepoUrl;
    if (patch.scope !== undefined) p.scope = patch.scope as Project['scope'];
    p.updatedAt = new Date();
    const saved = await this.repo.save(p);
    this.audit.record({
      actor: user,
      action: 'project.updated',
      resourceType: 'project',
      resourceId: id,
      before,
      after: { name: saved.name, description: saved.description, gitRepoUrl: saved.gitRepoUrl, scope: saved.scope },
    });
    return saved;
  }

  async remove(id: number, admin: RequestUser): Promise<void> {
    if (!this.isAdmin(admin)) throw new ForbiddenException('Admin only');
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    // Skills have onDelete: SET NULL — orphan skills fall back to legacy scope.
    await this.repo.remove(p);
    this.audit.record({
      actor: admin,
      action: 'project.deleted',
      resourceType: 'project',
      resourceId: id,
      before: { slug: p.slug, gitRepoUrl: p.gitRepoUrl, status: p.status },
    });
  }

  // Called by sync worker (P9) on first successful mirror of an approved project.
  async markActive(id: number): Promise<void> {
    const p = await this.repo.findOneBy({ id });
    if (!p) return;
    if (p.status === 'approved') {
      p.status = 'active';
      p.updatedAt = new Date();
      await this.repo.save(p);
    }
  }

  // Kept for backward compat with earlier stub callers.
  findAll(): Promise<Project[]> {
    return this.repo.find();
  }

  findOne(id: number): Promise<Project | null> {
    return this.repo.findOneBy({ id });
  }
}
