import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { ProjectsService } from '../projects/projects.service';
import { AuthedRequest } from '../common/user-request';
import { verifyGitlabToken } from './verify-gitlab-token.util';

// Per-project webhook guard (P7). Resolves :projectId path param → loads project →
// verifies X-Gitlab-Token against project.webhookSecret. Attaches project to req.
// Rejects if project not in approved/active state.
export interface WithProject {
  project?: {
    id: number;
    slug: string;
  };
}

@Injectable()
export class ProjectHmacGuard implements CanActivate {
  private readonly log = new Logger(ProjectHmacGuard.name);

  constructor(private readonly projects: ProjectsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { rawBody?: Buffer } & AuthedRequest & WithProject>();
    const raw = (req.params as Record<string, string>)?.projectId;
    const projectId = Number(raw);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      throw new NotFoundException('Invalid projectId');
    }

    const project = await this.projects.findOne(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.status !== 'approved' && project.status !== 'active') {
      this.log.warn(`webhook rejected — project ${projectId} status=${project.status}`);
      throw new ForbiddenException(`Project status '${project.status}' — webhook disabled`);
    }

    const token = String(req.header('x-gitlab-token') ?? '');
    if (!token) throw new ForbiddenException('Missing X-Gitlab-Token');
    if (!verifyGitlabToken(token, project.webhookSecret, req.rawBody)) {
      this.log.warn(`webhook HMAC mismatch project=${projectId}`);
      throw new ForbiddenException('Invalid webhook signature');
    }

    req.project = { id: project.id, slug: project.slug };
    return true;
  }
}
