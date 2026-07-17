import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { Skill } from '../entities/skill.entity';
import { SkillVersion } from '../entities/skill-version.entity';
import { ManifestValidator } from '../manifest-validator';
import { GitMirrorService } from './git-mirror.service';

export interface SyncSummary {
  scanned: number;
  upsertedSkills: number;
  newVersions: number;
  skipped: number;
  errors: { skill: string; reason: string }[];
  headSha: string;
}

// Walk mirror của skills-kythuat mono-repo → parse `skills/<name>/manifest.json` →
// upsert Skill (dept-scoped) + SkillVersion (unique per skill+commit).
// Version tạo với status='pending' — maintainer approve qua UI để set current.
@Injectable()
export class SkillSyncService {
  private readonly log = new Logger(SkillSyncService.name);
  private readonly manifestFile = 'manifest.json';

  constructor(
    private readonly mirror: GitMirrorService,
    private readonly validator: ManifestValidator,
    private readonly config: ConfigService,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
    @InjectRepository(Department) private readonly departments: Repository<Department>,
  ) {}

  isEnabled(): boolean {
    return !!this.config.get<string>('GITLAB_BASE_URL', '');
  }

  async syncAll(): Promise<SyncSummary> {
    if (!this.isEnabled()) {
      this.log.warn('sync skipped — GITLAB_BASE_URL empty');
      return { scanned: 0, upsertedSkills: 0, newVersions: 0, skipped: 0, errors: [], headSha: '' };
    }
    const headSha = await this.mirror.fetchLatest();
    const dirs = await this.mirror.listSkillDirs();
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
        const result = await this.syncOne(dir);
        if (result === 'upserted') summary.upsertedSkills++;
        if (result === 'new-version') summary.newVersions++;
        if (result === 'skipped') summary.skipped++;
      } catch (e) {
        summary.errors.push({ skill: dir, reason: (e as Error).message });
        this.log.warn(`sync error skill=${dir}: ${(e as Error).message}`);
      }
    }
    this.log.log(
      `sync done head=${headSha.slice(0, 8)} scanned=${summary.scanned} newVer=${summary.newVersions} err=${summary.errors.length}`,
    );
    return summary;
  }

  private async syncOne(skillDir: string): Promise<'upserted' | 'new-version' | 'skipped'> {
    const manifestPath = `skills/${skillDir}/${this.manifestFile}`;
    const manifestRaw = await this.mirror.showFile(manifestPath);
    if (!manifestRaw) throw new Error(`missing ${manifestPath}`);

    const parsed = this.validator.validate(JSON.parse(manifestRaw));
    if (!parsed.valid) {
      throw new Error(`invalid manifest: ${parsed.errors.map((e) => `${e.path}:${e.message}`).join(', ')}`);
    }
    const manifest = parsed.data;

    if (manifest.name !== skillDir) {
      throw new Error(`manifest name "${manifest.name}" != dir "${skillDir}"`);
    }

    const dept = await this.departments.findOne({ where: { code: manifest.department } });
    if (!dept) throw new Error(`unknown department "${manifest.department}"`);

    const commitSha = await this.mirror.lastCommitForPath(`skills/${skillDir}`);
    if (!commitSha) throw new Error('no commit found for path');

    // Đọc SKILL.md để nạp `body` — MCP load_skill trả trực tiếp.
    const bodyPath = `skills/${skillDir}/${manifest.entrypoint || 'SKILL.md'}`;
    const body = await this.mirror.showFile(bodyPath, commitSha);
    if (!body) throw new Error(`missing ${bodyPath}`);

    let skill = await this.skills.findOne({ where: { departmentId: dept.id, name: manifest.name } });
    let upserted = false;
    if (!skill) {
      skill = this.skills.create({
        name: manifest.name,
        departmentId: dept.id,
        repoUrl: this.buildRepoUrl(),
        description: manifest.description,
        tags: manifest.tags,
        status: 'active',
      });
      skill = await this.skills.save(skill);
      upserted = true;
    } else {
      // Update metadata từ manifest mới nhất.
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

  private buildRepoUrl(): string {
    const base = this.config.get<string>('GITLAB_BASE_URL', '');
    const slug = this.config.get<string>('SKILLS_MONO_REPO', 'onemcp/skills-kythuat');
    return `${base.replace(/\/$/, '')}/${slug}`;
  }
}
