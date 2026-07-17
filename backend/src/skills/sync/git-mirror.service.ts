import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

// Mirror = bare clone của skills mono-repo. Fetch từ GitLab bằng deploy token (C2 mitigation).
// Không checkout — chỉ đọc file qua `git show <ref>:<path>` để tiết kiệm disk + tránh race.
@Injectable()
export class GitMirrorService {
  private readonly log = new Logger(GitMirrorService.name);
  private readonly root: string;
  private readonly repoSlug: string;
  private readonly branch: string;

  constructor(private readonly config: ConfigService) {
    this.root = this.config.get<string>('GIT_MIRROR_ROOT', '/var/lib/onemcp/mirrors');
    this.repoSlug = this.config.get<string>('SKILLS_MONO_REPO', 'onemcp/skills-kythuat');
    this.branch = this.config.get<string>('SKILLS_MONO_BRANCH', 'main');
  }

  get mirrorPath(): string {
    return path.join(this.root, this.repoSlug.replace(/\//g, '_') + '.git');
  }

  // Build authenticated URL nếu có deploy token. Format GitLab:
  // https://oauth2:<token>@gitlab.internal/<repo>.git
  private buildRemoteUrl(): string {
    const base = this.config.get<string>('GITLAB_BASE_URL', '');
    const token = this.config.get<string>('GITLAB_MIRROR_TOKEN', '');
    if (!base) throw new Error('GITLAB_BASE_URL empty — sync disabled');
    const url = new URL(base);
    if (token) {
      url.username = 'oauth2';
      url.password = token;
    }
    url.pathname = `/${this.repoSlug}.git`;
    return url.toString();
  }

  async ensureCloned(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    try {
      await fs.access(this.mirrorPath);
      this.log.debug(`mirror exists: ${this.mirrorPath}`);
      return;
    } catch {
      // not exist → clone
    }
    const remote = this.buildRemoteUrl();
    this.log.log(`cloning ${this.repoSlug} → ${this.mirrorPath}`);
    await simpleGit().clone(remote, this.mirrorPath, ['--mirror']);
  }

  async fetchLatest(): Promise<string> {
    await this.ensureCloned();
    const git = simpleGit(this.mirrorPath);
    await git.fetch(['--prune', 'origin']);
    const sha = (await git.raw(['rev-parse', `refs/heads/${this.branch}`])).trim();
    this.log.debug(`fetched ${this.branch}@${sha.slice(0, 8)}`);
    return sha;
  }

  private git(): SimpleGit {
    return simpleGit(this.mirrorPath);
  }

  // List subdirs của `skills/` tại commit hiện tại (branch head).
  async listSkillDirs(ref?: string): Promise<string[]> {
    const g = this.git();
    const target = ref ?? `refs/heads/${this.branch}`;
    const out = await g.raw(['ls-tree', '--name-only', `${target}:skills`]).catch(() => '');
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  // Read file content tại ref cụ thể. Trả về null nếu không có.
  async showFile(pathInRepo: string, ref?: string): Promise<string | null> {
    const g = this.git();
    const target = ref ?? `refs/heads/${this.branch}`;
    try {
      return await g.raw(['show', `${target}:${pathInRepo}`]);
    } catch {
      return null;
    }
  }

  // Commit sha cuối cùng chạm vào path (dùng làm version identifier per skill).
  async lastCommitForPath(pathInRepo: string, ref?: string): Promise<string | null> {
    const g = this.git();
    const target = ref ?? `refs/heads/${this.branch}`;
    try {
      const out = await g.raw(['log', '-n', '1', '--format=%H', target, '--', pathInRepo]);
      const sha = out.trim();
      return sha || null;
    } catch {
      return null;
    }
  }
}
