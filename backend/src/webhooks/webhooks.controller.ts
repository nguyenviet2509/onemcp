import { Body, Controller, Headers, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkillSyncQueue } from '../skills/sync/skill-sync.queue';
import { GitlabHmacGuard } from './gitlab-hmac.guard';

interface GitlabPushEvent {
  object_kind?: string;
  ref?: string;
  after?: string;
  project?: { path_with_namespace?: string };
}

@Controller('webhooks/gitlab')
export class WebhooksController {
  private readonly log = new Logger(WebhooksController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly queue: SkillSyncQueue,
  ) {}

  @Post()
  @UseGuards(GitlabHmacGuard)
  @HttpCode(202)
  async gitlab(
    @Body() body: GitlabPushEvent,
    @Headers('x-gitlab-event') event?: string,
  ) {
    const expectedRepo = this.config.get<string>('SKILLS_MONO_REPO', '');
    const branch = this.config.get<string>('SKILLS_MONO_BRANCH', 'main');
    const expectedRef = `refs/heads/${branch}`;

    const repo = body.project?.path_with_namespace ?? '';
    const ref = body.ref ?? '';

    if (event !== 'Push Hook' && body.object_kind !== 'push') {
      return { accepted: false, reason: 'not a push event' };
    }
    if (expectedRepo && repo && repo !== expectedRepo) {
      return { accepted: false, reason: `repo ${repo} != expected ${expectedRepo}` };
    }
    if (ref !== expectedRef) {
      return { accepted: false, reason: `ref ${ref} != ${expectedRef}` };
    }

    const jobId = await this.queue.enqueue({
      trigger: 'webhook',
      ref: body.ref,
      commitSha: body.after,
    });
    this.log.log(`push accepted repo=${repo} sha=${body.after?.slice(0, 8)} jobId=${jobId}`);
    return { accepted: true, jobId };
  }
}
