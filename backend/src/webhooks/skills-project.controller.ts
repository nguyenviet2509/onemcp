import { Body, Controller, HttpCode, Logger, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SkillSyncQueue } from '../skills/sync/skill-sync.queue';
import { ProjectHmacGuard, WithProject } from './project-hmac.guard';

interface GitlabPushEvent {
  object_kind?: string;
  ref?: string;
  after?: string;
  project?: { path_with_namespace?: string };
}

// Per-project webhook endpoint (P7).
// Legacy mono-repo endpoint (`/webhooks/gitlab`) remains untouched.
@Controller('webhooks/skills')
export class SkillsProjectWebhookController {
  private readonly log = new Logger(SkillsProjectWebhookController.name);

  constructor(private readonly queue: SkillSyncQueue) {}

  @Post(':projectId')
  @UseGuards(ProjectHmacGuard)
  @HttpCode(202)
  async push(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: GitlabPushEvent,
    @Req() req: Request & WithProject,
  ) {
    if (body.object_kind && body.object_kind !== 'push') {
      return { accepted: false, reason: 'not a push event' };
    }
    const jobId = await this.queue.enqueue({
      trigger: 'webhook',
      ref: body.ref,
      commitSha: body.after,
      projectId,
      projectSlug: req.project?.slug,
    });
    this.log.log(`push accepted project=${projectId} sha=${body.after?.slice(0, 8)} jobId=${jobId}`);
    return { accepted: true, jobId, projectId };
  }
}
