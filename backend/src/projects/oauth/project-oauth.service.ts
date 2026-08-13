import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AuditLogService } from '../../audit/audit-log.service';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';
import { RequestUser } from '../../common/user-request';
import { Project, ProjectStatus } from '../entities/project.entity';
import { GitlabApiClient, parseRepoPath } from './gitlab-api.client';
import {
  ProjectOauthStatePayload,
  signState,
  verifyState,
} from './project-oauth-state.util';

const STATE_TTL_SECONDS = 600; // 10 min — enough for user to complete GitLab consent screen.

@Injectable()
export class ProjectOauthService {
  private readonly log = new Logger(ProjectOauthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cipher: TokenCipherService,
    private readonly audit: AuditLogService,
    @InjectRepository(Project) private readonly repo: Repository<Project>,
  ) {}

  private gitlabBase(): string {
    return this.config.get<string>('GITLAB_SSO_BASE_URL', 'https://gitlabs.inet.vn');
  }
  private appId(): string {
    return this.config.getOrThrow<string>('GITLAB_OAUTH_APP_ID');
  }
  private appSecret(): string {
    return this.config.getOrThrow<string>('GITLAB_OAUTH_APP_SECRET');
  }
  private redirectUri(): string {
    return this.config.getOrThrow<string>('GITLAB_OAUTH_PROJECT_REDIRECT_URI');
  }
  private stateSecret(): string {
    return (
      this.config.get<string>('PROJECT_OAUTH_STATE_SECRET') ??
      this.config.getOrThrow<string>('ONEMCP_ENCRYPTION_KEY')
    );
  }
  private webhookBase(): string {
    return this.config.getOrThrow<string>('WEBHOOK_PUBLIC_BASE_URL');
  }

  buildAuthorizeUrl(
    userId: number,
    body: {
      slug: string;
      name: string;
      description?: string;
      gitRepoUrl: string;
      scope?: 'public' | 'dept' | 'private';
    },
  ): string {
    const payload: ProjectOauthStatePayload = {
      slug: body.slug,
      name: body.name,
      description: body.description,
      gitRepoUrl: body.gitRepoUrl,
      scope: body.scope ?? 'private',
      userId,
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    };
    const state = signState(payload, this.stateSecret());
    const params = new URLSearchParams({
      client_id: this.appId(),
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      // 'api' scope needed to POST hooks + deploy_tokens (read_api is not enough).
      scope: 'api',
      state,
    });
    return `${this.gitlabBase().replace(/\/$/, '')}/oauth/authorize?${params.toString()}`;
  }

  async completeAuthorize(
    code: string,
    state: string,
    caller: RequestUser,
  ): Promise<{ project: Project; webhookSecret: string }> {
    const payload = verifyState(state, this.stateSecret());
    if (payload.userId !== caller.id) {
      throw new BadRequestException('State userId mismatch — restart authorization');
    }
    // 1. Exchange code → access_token.
    const accessToken = await this.exchangeCode(code);

    // 2. Read project metadata via GitLab API.
    const gl = new GitlabApiClient(this.gitlabBase(), accessToken);
    const repoPath = parseRepoPath(payload.gitRepoUrl);
    const glProject = await gl.getProject(repoPath);
    const defaultBranch = glProject.default_branch || 'main';

    // 3. Reserve slug + secret in DB so we have projectId to register webhook against.
    const webhookSecret = randomBytes(32).toString('hex');
    const entity = this.repo.create({
      slug: payload.slug,
      name: payload.name,
      description: payload.description ?? null,
      gitRepoUrl: payload.gitRepoUrl,
      branch: defaultBranch,
      scope: payload.scope,
      departmentId: caller.departmentId || null,
      ownerId: caller.id,
      webhookSecret,
      status: 'pending' as ProjectStatus,
    });
    const saved = await this.repo.save(entity);

    // 4. Provision webhook + deploy token on GitLab.
    try {
      const hookUrl = `${this.webhookBase().replace(/\/$/, '')}/api/webhooks/skills/${saved.id}`;
      await gl.createWebhook(glProject.id, hookUrl, webhookSecret);
      const deploy = await gl.createDeployToken(glProject.id, `onemcp-sync-${saved.slug}`);
      // Encrypt + persist token so worker can clone private repos.
      saved.deployTokenCiphertext = Buffer.from(this.cipher.encrypt(deploy.token), 'utf8');
      await this.repo.save(saved);
    } catch (e) {
      // GitLab call failed AFTER project row inserted → rollback so member can retry cleanly.
      await this.repo.remove(saved);
      throw e;
    }

    this.audit.record({
      actor: caller,
      action: 'project.registered_via_oauth',
      resourceType: 'project',
      resourceId: saved.id,
      after: { slug: saved.slug, gitlabProjectId: glProject.id, defaultBranch },
    });
    this.log.log(`provisioned project=${saved.id} gitlab=${glProject.id} branch=${defaultBranch}`);
    return { project: saved, webhookSecret };
  }

  private async exchangeCode(code: string): Promise<string> {
    const res = await fetch(`${this.gitlabBase().replace(/\/$/, '')}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.appId(),
        client_secret: this.appSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri(),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitLab token exchange failed ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('GitLab token exchange missing access_token');
    return json.access_token;
  }
}
