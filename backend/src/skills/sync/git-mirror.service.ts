import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

// P9: MirrorHandle identifies a specific mirror dir + branch tuple.
// Legacy mono-repo path uses default handle from env; per-project uses
// per-project handle built from project.gitRepoUrl.
export interface MirrorHandle {
  repoUrl: string;
  mirrorDir: string;
  branch: string;
  // Optional auth token (deploy token) — injected as `oauth2:<token>@` in URL.
  token?: string;
}

// Mirror = bare clone của repo. Fetch bằng deploy token (C2 mitigation).
// Không checkout — chỉ đọc file qua `git show <ref>:<path>` để tiết kiệm disk + tránh race.
@Injectable()
export class GitMirrorService {
  private readonly log = new Logger(GitMirrorService.name);
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = this.config.get<string>('GIT_MIRROR_ROOT', '/var/lib/onemcp/mirrors');
  }

  // Legacy handle from env (mono-repo skills-kythuat).
  legacyHandle(): MirrorHandle {
    const base = this.config.get<string>('GITLAB_BASE_URL', '');
    if (!base) throw new Error('GITLAB_BASE_URL empty — legacy sync disabled');
    const slug = this.config.get<string>('SKILLS_MONO_REPO', 'onemcp/skills-kythuat');
    const branch = this.config.get<string>('SKILLS_MONO_BRANCH', 'main');
    const token = this.config.get<string>('GITLAB_MIRROR_TOKEN', '') || undefined;
    const url = new URL(base);
    url.pathname = `/${slug}.git`;
    return {
      repoUrl: url.toString(),
      mirrorDir: path.join(this.root, slug.replace(/\//g, '_') + '.git'),
      branch,
      token,
    };
  }

  // Per-project handle. mirrorDir isolated by projectId to avoid collisions.
  projectHandle(projectId: number, repoUrl: string, branch = 'main', token?: string): MirrorHandle {
    return {
      repoUrl,
      mirrorDir: path.join(this.root, `project-${projectId}.git`),
      branch,
      token,
    };
  }

  // Redact token from URL for logging.
  private sanitize(url: string): string {
    try {
      const u = new URL(url);
      if (u.password) u.password = '***';
      if (u.username) u.username = '***';
      return u.toString();
    } catch {
      return url;
    }
  }

  private authedUrl(h: MirrorHandle): string {
    if (!h.token) return h.repoUrl;
    try {
      const u = new URL(h.repoUrl);
      u.username = 'oauth2';
      u.password = h.token;
      return u.toString();
    } catch {
      return h.repoUrl;
    }
  }

  async ensureCloned(h: MirrorHandle): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    try {
      await fs.access(h.mirrorDir);
      this.log.debug(`mirror exists: ${h.mirrorDir}`);
      return;
    } catch {
      // fall through
    }
    this.log.log(`cloning ${this.sanitize(h.repoUrl)} → ${h.mirrorDir}`);
    await simpleGit().clone(this.authedUrl(h), h.mirrorDir, ['--mirror']);
  }

  async fetchLatest(h: MirrorHandle): Promise<string> {
    await this.ensureCloned(h);
    const git = simpleGit(h.mirrorDir);
    await git.fetch(['--prune', 'origin']);
    const sha = (await git.raw(['rev-parse', `refs/heads/${h.branch}`])).trim();
    this.log.debug(`fetched ${h.branch}@${sha.slice(0, 8)} dir=${h.mirrorDir}`);
    return sha;
  }

  private git(mirrorDir: string): SimpleGit {
    return simpleGit(mirrorDir);
  }

  // List subdirs của `skills/` tại commit hiện tại (branch head).
  async listSkillDirs(h: MirrorHandle, ref?: string): Promise<string[]> {
    const g = this.git(h.mirrorDir);
    const target = ref ?? `refs/heads/${h.branch}`;
    const out = await g.raw(['ls-tree', '--name-only', `${target}:skills`]).catch(() => '');
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  async showFile(h: MirrorHandle, pathInRepo: string, ref?: string): Promise<string | null> {
    const g = this.git(h.mirrorDir);
    const target = ref ?? `refs/heads/${h.branch}`;
    try {
      return await g.raw(['show', `${target}:${pathInRepo}`]);
    } catch {
      return null;
    }
  }

  async lastCommitForPath(h: MirrorHandle, pathInRepo: string, ref?: string): Promise<string | null> {
    const g = this.git(h.mirrorDir);
    const target = ref ?? `refs/heads/${h.branch}`;
    try {
      const out = await g.raw(['log', '-n', '1', '--format=%H', target, '--', pathInRepo]);
      const sha = out.trim();
      return sha || null;
    } catch {
      return null;
    }
  }
}
