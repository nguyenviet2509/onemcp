import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { SkillsModule } from '../skills/skills.module';
import { SearchModule } from '../search/search.module';
import { GitlabHmacGuard } from './gitlab-hmac.guard';
import { ProjectHmacGuard } from './project-hmac.guard';
import { SkillsProjectWebhookController } from './skills-project.controller';
import { WebhooksController } from './webhooks.controller';
import { AlertmanagerController } from './alertmanager.controller';
import { AlertmanagerService } from './alertmanager.service';
import { AlertmanagerTokenGuard } from './alertmanager-token.guard';
import { SlackService } from './slack.service';
import { AlertmanagerDedupService } from './dedup.service';

@Module({
  imports: [SkillsModule, SearchModule, ProjectsModule], // MetricsModule is @Global()
  providers: [
    GitlabHmacGuard,
    ProjectHmacGuard,
    AlertmanagerTokenGuard,
    AlertmanagerService,
    SlackService,
    AlertmanagerDedupService,
  ],
  controllers: [WebhooksController, SkillsProjectWebhookController, AlertmanagerController],
})
export class WebhooksModule {}
