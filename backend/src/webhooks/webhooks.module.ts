import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module';
import { GitlabHmacGuard } from './gitlab-hmac.guard';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [SkillsModule],
  providers: [GitlabHmacGuard],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
