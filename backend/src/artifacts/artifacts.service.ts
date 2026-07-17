import { createHash } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestUser } from '../common/user-request';
import { MetricsService } from '../metrics/metrics.service';
import { ArtifactType } from './artifact-type.enum';
import { ReviewArtifactDto, SubmitArtifactDto, UpdateArtifactDto } from './dto/submit-artifact.dto';
import { Artifact } from './entities/artifact.entity';
import { ArtifactVersion } from './entities/artifact-version.entity';
import { RunbookLoadEvent } from './entities/runbook-load-event.entity';
import { TemplateValidator } from './templates/template-validator';

export interface ArtifactListFilter {
  type?: ArtifactType;
  tag?: string;
  q?: string;
  status?: 'pending' | 'published' | 'rejected';
}

export interface LoadRunbookOptions {
  name?: string;    // slug hoặc title exact match
  service?: string; // tìm theo service nếu name không chỉ định
}

const REVIEWER_ROLES = ['maintainer', 'dept-admin', 'super-admin'];
const CONTRIBUTOR_ROLES = ['contributor', ...REVIEWER_ROLES];

@Injectable()
export class ArtifactsService {
  private readonly log = new Logger(ArtifactsService.name);

  constructor(
    @InjectRepository(Artifact) private readonly artifacts: Repository<Artifact>,
    @InjectRepository(ArtifactVersion) private readonly versions: Repository<ArtifactVersion>,
    @InjectRepository(RunbookLoadEvent) private readonly runbookEvents: Repository<RunbookLoadEvent>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly templates: TemplateValidator,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  // Nếu client gửi structured → validate + compile body. Ngược lại chấp nhận body-only
  // (backwards compat cho MCP submit đơn giản + short KB entries).
  private prepareContent(
    type: ArtifactType,
    body: string | undefined,
    structured: Record<string, unknown> | undefined,
  ): { body: string; structured: Record<string, unknown> } {
    if (structured && Object.keys(structured).length > 0) {
      const result = this.templates.validateAndCompile(type, structured);
      return { body: result.body, structured: result.structured as unknown as Record<string, unknown> };
    }
    if (!body || body.trim().length === 0) {
      throw new BadRequestException('body hoặc structured phải cung cấp');
    }
    return { body, structured: {} };
  }

  // Trích xuất giá trị service từ structured content cho type=runbook.
  private extractService(type: ArtifactType, structured: Record<string, unknown>): string | null {
    if (type !== 'runbook') return null;
    // structured có thể là flat {service: ...} hoặc {fields: {service: ...}}
    const fields = (structured as Record<string, unknown>).fields;
    if (fields && typeof fields === 'object') {
      const svc = (fields as Record<string, unknown>)['service'];
      return typeof svc === 'string' && svc.trim() ? svc.trim() : null;
    }
    const svc = (structured as Record<string, unknown>)['service'];
    return typeof svc === 'string' && svc.trim() ? svc.trim() : null;
  }

  // Hash IP cho audit log — dùng sha256(ip + salt). Skip nếu salt rỗng (RT-15).
  private hashIp(ip: string | undefined): string | null {
    if (!ip) return null;
    const salt = this.config.get<string>('RUNBOOK_EVENTS_IP_SALT', '');
    if (!salt) return null;
    return createHash('sha256').update(ip + salt).digest('hex');
  }

  private isReviewer(user: RequestUser): boolean {
    return user.roles.some((r) => REVIEWER_ROLES.includes(r));
  }
  private canContribute(user: RequestUser): boolean {
    return user.roles.some((r) => CONTRIBUTOR_ROLES.includes(r));
  }

  async create(user: RequestUser, dto: SubmitArtifactDto): Promise<{ artifact: Artifact; version: ArtifactVersion }> {
    if (!this.canContribute(user)) {
      this.metrics.artifactSubmits.inc({ type: dto.type, result: 'forbidden' });
      throw new ForbiddenException('Không có quyền submit artifact');
    }

    const dup = await this.artifacts.findOne({
      where: { departmentId: user.departmentId, slug: dto.slug },
    });
    if (dup) {
      this.metrics.artifactSubmits.inc({ type: dto.type, result: 'duplicate' });
      throw new BadRequestException(`slug "${dto.slug}" đã tồn tại trong dept`);
    }

    const content = this.prepareContent(dto.type, dto.body, dto.structured);

    // Trích xuất service từ structured trước khi normalize (dto.structured chứa raw input).
    const serviceValue = this.extractService(dto.type, dto.structured ?? {});

    return this.ds.transaction(async (m) => {
      const artifactRepo = m.getRepository(Artifact);
      const versionRepo = m.getRepository(ArtifactVersion);

      const artifact = await artifactRepo.save(
        artifactRepo.create({
          type: dto.type,
          title: dto.title,
          slug: dto.slug,
          departmentId: user.departmentId,
          ownerId: user.id,
          status: 'pending',
          tags: dto.tags,
          service: serviceValue, // V1 — populate service column for runbook type
        }),
      );

      const version = await versionRepo.save(
        versionRepo.create({
          artifactId: artifact.id,
          versionNo: 1,
          authorId: user.id,
          body: content.body,
          structured: content.structured,
          status: 'pending',
        }),
      );
      this.metrics.artifactSubmits.inc({ type: dto.type, result: 'ok' });
      return { artifact, version };
    });
  }

  async list(user: RequestUser, filter: ArtifactListFilter = {}): Promise<Artifact[]> {
    const qb = this.artifacts
      .createQueryBuilder('a')
      .where('a.department_id = :dept', { dept: user.departmentId })
      .andWhere("a.status <> 'archived'");

    // Non-reviewer: chỉ thấy published + own pending.
    if (!this.isReviewer(user)) {
      qb.andWhere("(a.status = 'published' OR a.owner_id = :uid)", { uid: user.id });
    }

    if (filter.type) qb.andWhere('a.type = :type', { type: filter.type });
    if (filter.status) qb.andWhere('a.status = :status', { status: filter.status });
    if (filter.tag) qb.andWhere(':tag = ANY(a.tags)', { tag: filter.tag });
    if (filter.q) qb.andWhere('(a.title ILIKE :q OR a.slug ILIKE :q)', { q: `%${filter.q}%` });

    return qb.orderBy('a.updatedAt', 'DESC').limit(100).getMany();
  }

  async findOne(user: RequestUser, id: string): Promise<{ artifact: Artifact; version: ArtifactVersion | null }> {
    const artifact = await this.artifacts.findOne({
      where: { id, departmentId: user.departmentId },
    });
    if (!artifact) throw new NotFoundException('Artifact không tồn tại');

    // ACL: non-reviewer + non-owner chỉ xem published.
    if (artifact.status !== 'published' && !this.isReviewer(user) && artifact.ownerId !== user.id) {
      throw new ForbiddenException('Không có quyền xem artifact này');
    }

    // Reviewer + owner thấy latest version bất kể status.
    // Viewer thấy current (published) version.
    let version: ArtifactVersion | null = null;
    if (this.isReviewer(user) || artifact.ownerId === user.id) {
      version = await this.versions.findOne({
        where: { artifactId: artifact.id },
        order: { versionNo: 'DESC' },
      });
    } else if (artifact.currentVersionId) {
      version = await this.versions.findOne({ where: { id: artifact.currentVersionId } });
    }
    return { artifact, version };
  }

  async listVersions(user: RequestUser, id: string): Promise<ArtifactVersion[]> {
    const { artifact } = await this.findOne(user, id);
    return this.versions.find({
      where: { artifactId: artifact.id },
      order: { versionNo: 'DESC' },
    });
  }

  // Update = tạo new pending version. Optimistic lock: expected_version_no phải khớp
  // MAX(version_no) hiện tại; nếu có ai đó đã submit version mới sẽ 409.
  async update(user: RequestUser, id: string, dto: UpdateArtifactDto): Promise<{ artifact: Artifact; version: ArtifactVersion }> {
    const artifact = await this.artifacts.findOne({
      where: { id, departmentId: user.departmentId },
    });
    if (!artifact) throw new NotFoundException('Artifact không tồn tại');
    // Chỉ owner + reviewer update được.
    if (artifact.ownerId !== user.id && !this.isReviewer(user)) {
      throw new ForbiddenException('Chỉ owner hoặc maintainer update được');
    }

    return this.ds.transaction(async (m) => {
      const aRepo = m.getRepository(Artifact);
      const vRepo = m.getRepository(ArtifactVersion);

      const latest = await vRepo.findOne({
        where: { artifactId: artifact.id },
        order: { versionNo: 'DESC' },
      });
      const currentNo = latest?.versionNo ?? 0;
      if (dto.expected_version_no !== currentNo) {
        throw new ConflictException(
          `Version conflict: expected ${dto.expected_version_no} but current is ${currentNo}`,
        );
      }

      const nextNo = currentNo + 1;
      const content = this.prepareContent(artifact.type, dto.body, dto.structured);

      // Cập nhật service column nếu type=runbook và structured có service mới.
      if (artifact.type === 'runbook' && dto.structured) {
        const newService = this.extractService(artifact.type, dto.structured);
        if (newService) artifact.service = newService;
      }

      const version = await vRepo.save(
        vRepo.create({
          artifactId: artifact.id,
          versionNo: nextNo,
          authorId: user.id,
          body: content.body,
          structured: content.structured,
          status: 'pending',
        }),
      );

      // Reset artifact status về pending (còn currentVersionId trỏ published cũ cho reader tiếp tục thấy).
      artifact.status = 'pending';
      artifact.updatedAt = new Date();
      if (dto.tags) artifact.tags = dto.tags;
      const saved = await aRepo.save(artifact);
      return { artifact: saved, version };
    });
  }

  async review(user: RequestUser, id: string, dto: ReviewArtifactDto): Promise<Artifact> {
    if (!this.isReviewer(user)) throw new ForbiddenException('Chỉ maintainer/admin review');
    const artifact = await this.artifacts.findOne({
      where: { id, departmentId: user.departmentId },
    });
    if (!artifact) throw new NotFoundException('Artifact không tồn tại');

    const pending = await this.versions.findOne({
      where: { artifactId: artifact.id, status: 'pending' },
      order: { versionNo: 'DESC' },
    });
    if (!pending) throw new BadRequestException('Không có pending version nào để review');

    return this.ds.transaction(async (m) => {
      const aRepo = m.getRepository(Artifact);
      const vRepo = m.getRepository(ArtifactVersion);

      pending.reviewedAt = new Date();
      pending.reviewedBy = user.id;
      pending.reviewNote = dto.note ?? null;

      if (dto.action === 'approve') {
        pending.status = 'active';
        await vRepo.save(pending);
        artifact.currentVersionId = pending.id;
        artifact.status = 'published';
      } else {
        pending.status = 'rejected';
        await vRepo.save(pending);
        artifact.status = artifact.currentVersionId ? 'published' : 'rejected';
      }
      artifact.updatedAt = new Date();
      return aRepo.save(artifact);
    });
  }

  // Load runbook theo name (slug/title) hoặc service — gọi bởi MCP load_runbook tool.
  // Ghi audit event + increment metrics khi tìm thấy.
  async loadRunbook(
    user: RequestUser,
    opts: LoadRunbookOptions,
    ip?: string,
  ): Promise<
    | { kind: 'single'; artifact: Artifact; version: ArtifactVersion; body: string }
    | { kind: 'list'; items: Artifact[] }
    | { kind: 'not_found' }
  > {
    if (opts.name) {
      // Tìm theo slug exact match trước, fallback title ILIKE.
      const artifact = await this.artifacts.findOne({
        where: [
          { departmentId: user.departmentId, type: 'runbook', slug: opts.name },
        ],
      }) ?? await this.artifacts
          .createQueryBuilder('a')
          .where('a.department_id = :dept', { dept: user.departmentId })
          .andWhere("a.type = 'runbook'")
          .andWhere('a.title ILIKE :title', { title: opts.name })
          .andWhere("a.status = 'published'")
          .getOne();

      if (!artifact) return { kind: 'not_found' };

      // Lấy published version (currentVersionId) hoặc latest.
      const version = artifact.currentVersionId
        ? await this.versions.findOne({ where: { id: artifact.currentVersionId } })
        : await this.versions.findOne({
            where: { artifactId: artifact.id },
            order: { versionNo: 'DESC' },
          });

      if (!version) return { kind: 'not_found' };

      // Ghi audit + metrics.
      await this.recordRunbookLoadEvent(artifact, version, user, ip);
      this.metrics.runbookLoads.inc({
        name: artifact.slug,
        service: artifact.service ?? '',
      });

      return { kind: 'single', artifact, version, body: version.body };
    }

    if (opts.service) {
      // List top 5 runbooks theo service match.
      // H4 fix: exact case-insensitive match to avoid ILIKE wildcard leak (agent could pass '%').
      const items = await this.artifacts
        .createQueryBuilder('a')
        .where('a.department_id = :dept', { dept: user.departmentId })
        .andWhere("a.type = 'runbook'")
        .andWhere('LOWER(a.service) = LOWER(:svc)', { svc: opts.service })
        .andWhere("a.status = 'published'")
        .orderBy('a.updatedAt', 'DESC')
        .limit(5)
        .getMany();

      return { kind: 'list', items };
    }

    return { kind: 'not_found' };
  }

  private async recordRunbookLoadEvent(
    artifact: Artifact,
    version: ArtifactVersion,
    user: RequestUser,
    ip?: string,
  ): Promise<void> {
    try {
      const event = this.runbookEvents.create({
        artifactId: artifact.id,
        artifactVersionId: version.id,
        userId: String(user.id),
        ipHash: this.hashIp(ip),
      });
      await this.runbookEvents.save(event);
    } catch (err) {
      // M3 fix: audit failure không throw, nhưng phải log để phát hiện regression.
      this.log.warn(
        `runbook_load_events insert failed artifact=${artifact.id}: ${(err as Error).message}`,
      );
    }
  }
}
