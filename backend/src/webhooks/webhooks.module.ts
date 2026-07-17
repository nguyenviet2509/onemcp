import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module';
import { SearchModule } from '../search/search.module';
import { GitlabHmacGuard } from './gitlab-hmac.guard';
import { WebhooksController } from './webhooks.controller';
import { AlertmanagerController } from './alertmanager.controller';
import { AlertmanagerService } from './alertmanager.service';
import { AlertmanagerTokenGuard } from './alertmanager-token.guard';
import { SlackService } from './slack.service';
import { AlertmanagerDedupService } from './dedup.service';

@Module({
  imports: [SkillsModule, SearchModule], // MetricsModule is @Global() — no import needed
  providers: [
    GitlabHmacGuard,
    AlertmanagerTokenGuard,
    AlertmanagerService,
    SlackService,
    AlertmanagerDedupService,
  ],
  controllers: [WebhooksController, AlertmanagerController],
})
export class WebhooksModule {}
