import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';
import { Department } from '../../departments/entities/department.entity';
import { Project } from '../../projects/entities/project.entity';
import { ProjectsService } from '../../projects/projects.service';
import { Skill } from '../entities/skill.entity';
import { SkillVersion } from '../entities/skill-version.entity';
import { ManifestValidator } from '../manifest-validator';
import { GitMirrorService, MirrorHandle } from './git-mirror.service';

export interface SyncSummary {
  scanned: number;
  upsertedSkills: number;
  newVersions: number;
  skipped: number;
  errors: { skill: string; reason: string }[];
  headSha: string;
}

// Walk mirror → parse `skills/<name>/manifest.json` →
// upsert Skill + SkillVersion (unique per skill+commit).
// P9: syncProject(projectId) — per-project variant. syncAll() unchanged for legacy mono.
@Injectable()
export class SkillSyncService {
  private readonly log = new Logger(SkillSyncService.name);
  private readonly manifestFile = 'manifest.json';

  constructor(
    private readonly mirror: GitMirrorService,
    private readonly validator: ManifestValidator,
    private readonly config: ConfigService,
    private readonly cipher: TokenCipherService,
    private readonly projects: ProjectsService,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
    @InjectRepository(Department) private readonly departments: Repository<Department>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
  ) {}

  isEnabled(): boolean {
    return !!this.config.get<string>('GITLAB_BASE_URL', '');
  }

  async syncAll(): Promise<SyncSummary> {
    if (!this.isEnabled()) {
      this.log.warn('legacy sync skipped — GITLAB_BASE_URL empty');
      return { scanned: 0, upsertedSkills: 0, newVersions: 0, skipped: 0, errors: [], headSha: '' };
    }
    const handle = this.mirror.legacyHandle();
    return this.runSync(handle, null);
  }

  async syncProject(projectId: number): Promise<SyncSummary> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new Error(`project ${projectId} not found`);
    if (project.status !== 'approved' && project.status !== 'active') {
      throw new Error(`project ${projectId} status='${project.status}' — sync disabled`);
    }

    const token = this.decryptDeployToken(project);
    // Default branch = 'main'; TODO expose per-project branch column when needed.
    const handle = this.mirror.projectHandle(project.id, project.gitRepoUrl, 'main', token);
    const summary = await this.runSync(handle, project);

    // First successful sync of an approved project → active.
    if (project.status === 'approved' && summary.errors.length < summary.scanned) {
      await this.projects.markActive(project.id);
    }
    return summary;
  }

  private decryptDeployToken(project: Project): string | undefined {
    if (!project.deployTokenCiphertext) return undefined;
    try {
      const payload = project.deployTokenCiphertext.toString('utf8');
      return this.cipher.decrypt(payload);
    } catch (e) {
      this.log.warn(`deploy token decrypt failed project=${project.id}: ${(e as Error).message}`);
      return undefined;
    }
  }

  private async runSync(handle: MirrorHandle, project: Project | null): Promise<SyncSummary> {
    const headSha = await this.mirror.fetchLatest(handle);
    const dirs = await this.mirror.listSkillDirs(handle);
    const summary: SyncSummary = {
      scanned: dirs.length,
      upsertedSkills: 0,
      newVersions: 0,
      skipped: 0,
      errors: [],
      headSha,
    };

    for (const dir of dirs) {
      try {
        const result = await this.syncOne(handle, dir, project);
        if (result === 'upserted') summary.upsertedSkills++;
        if (result === 'new-version') summary.newVersions++;
        if (result === 'skipped') summary.skipped++;
      } catch (e) {
        summary.errors.push({ skill: dir, reason: (e as Error).message });
        this.log.warn(`sync error skill=${dir}: ${(e as Error).message}`);
      }
    }
    this.log.log(
      `sync done project=${project?.id ?? 'legacy'} head=${headSha.slice(0, 8)} scanned=${summary.scanned} newVer=${summary.newVersions} err=${summary.errors.length}`,
    );
    return summary;
  }

  private async syncOne(
    handle: MirrorHandle,
    skillDir: string,
    project: Project | null,
  ): Promise<'upserted' | 'new-version' | 'skipped'> {
    const manifestPath = `skills/${skillDir}/${this.manifestFile}`;
    const manifestRaw = await this.mirror.showFile(handle, manifestPath);
    if (!manifestRaw) throw new Error(`missing ${manifestPath}`);

    const parsed = this.validator.validate(JSON.parse(manifestRaw));
    if (!parsed.valid) {
      throw new Error(`invalid manifest: ${parsed.errors.map((e) => `${e.path}:${e.message}`).join(', ')}`);
    }
    const manifest = parsed.data;

    if (manifest.name !== skillDir) {
      throw new Error(`manifest name "${manifest.name}" != dir "${skillDir}"`);
    }

    // Multi-project: dept resolved from project.departmentId (fallback to manifest for legacy).
    let deptId: number;
    if (project) {
      if (project.departmentId == null) {
        throw new Error(`project ${project.id} has no departmentId — cannot scope skill`);
      }
      deptId = project.departmentId;
    } else {
      const dept = await this.departments.findOne({ where: { code: manifest.department } });
      if (!dept) throw new Error(`unknown department "${manifest.department}"`);
      deptId = dept.id;
    }

    const commitSha = await this.mirror.lastCommitForPath(handle, `skills/${skillDir}`);
    if (!commitSha) throw new Error('no commit found for path');

    const bodyPath = `skills/${skillDir}/${manifest.entrypoint || 'SKILL.md'}`;
    const body = await this.mirror.showFile(handle, bodyPath, commitSha);
    if (!body) throw new Error(`missing ${bodyPath}`);

    // Lookup existing: (projectId, name) if project set; else legacy (deptId, name) with projectId IS NULL.
    let skill = project
      ? await this.skills.findOne({ where: { projectId: project.id, name: manifest.name } })
      : await this.skills.findOne({ where: { departmentId: deptId, name: manifest.name, projectId: IsNull() } });

    let upserted = false;
    if (!skill) {
      skill = this.skills.create({
        name: manifest.name,
        departmentId: deptId,
        projectId: project?.id ?? null,
        repoUrl: project ? project.gitRepoUrl : this.buildLegacyRepoUrl(),
        description: manifest.description,
        tags: manifest.tags,
        status: 'active',
      });
      skill = await this.skills.save(skill);
      upserted = true;
    } else {
      skill.description = manifest.description;
      skill.tags = manifest.tags;
      skill.updatedAt = new Date();
      await this.skills.save(skill);
    }

    const existing = await this.versions.findOne({
      where: { skillId: skill.id, commitSha },
    });
    if (existing) return 'skipped';

    await this.versions.save(
      this.versions.create({
        skillId: skill.id,
        commitSha,
        version: manifest.version,
        manifest: manifest as unknown as Record<string, unknown>,
        body,
        status: 'pending',
      }),
    );
    return upserted ? 'upserted' : 'new-version';
  }

  private buildLegacyRepoUrl(): string {
    const base = this.config.get<string>('GITLAB_BASE_URL', '');
    const slug = this.config.get<string>('SKILLS_MONO_REPO', 'onemcp/skills-kythuat');
    return `${base.replace(/\/$/, '')}/${slug}`;
  }
}
