import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AuditLogService } from '../../audit/audit-log.service';
import { SkillSyncService } from './skill-sync.service';
import { SkillSyncJobData, SKILL_SYNC_QUEUE } from './skill-sync.queue';

@Processor(SKILL_SYNC_QUEUE, { concurrency: 1 })
export class SkillSyncProcessor extends WorkerHost {
  private readonly log = new Logger(SkillSyncProcessor.name);

  constructor(private readonly sync: SkillSyncService, private readonly audit: AuditLogService) {
    super();
  }

  async process(job: Job<SkillSyncJobData>) {
    const projectId = job.data.projectId;
    this.log.log(`process jobId=${job.id} trigger=${job.data.trigger} project=${projectId ?? 'legacy'}`);
    this.audit.record({
      action: 'sync.started',
      resourceType: 'project',
      resourceId: projectId ?? 'legacy',
      after: { trigger: job.data.trigger, ref: job.data.ref, commitSha: job.data.commitSha },
    });
    try {
      const summary = projectId
        ? await this.sync.syncProject(projectId)
        : await this.sync.syncAll();
      this.log.log(
        `job=${job.id} done head=${summary.headSha.slice(0, 8)} newVer=${summary.newVersions} err=${summary.errors.length}`,
      );
      this.audit.record({
        action: 'sync.completed',
        resourceType: 'project',
        resourceId: projectId ?? 'legacy',
        after: { headSha: summary.headSha, newVersions: summary.newVersions, errors: summary.errors.length },
      });
      return summary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.audit.record({
        action: 'sync.failed',
        resourceType: 'project',
        resourceId: projectId ?? 'legacy',
        after: { error: msg.slice(0, 500) },
      });
      throw err;
    }
  }
}
