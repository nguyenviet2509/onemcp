import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../departments/entities/department.entity';
import { Skill } from './entities/skill.entity';
import { SkillLoadEvent } from './entities/skill-load-event.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { ManifestValidator } from './manifest-validator';
import { SkillApprovalService } from './skill-approval.service';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { GitMirrorService } from './sync/git-mirror.service';
import { SkillSyncCron } from './sync/skill-sync.cron';
import { SkillSyncProcessor } from './sync/skill-sync.processor';
import { SkillSyncQueue, SKILL_SYNC_QUEUE } from './sync/skill-sync.queue';
import { SkillSyncService } from './sync/skill-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Skill, SkillVersion, SkillLoadEvent, Department]),
    BullModule.registerQueue({ name: SKILL_SYNC_QUEUE }),
  ],
  providers: [
    SkillsService,
    ManifestValidator,
    SkillApprovalService,
    GitMirrorService,
    SkillSyncService,
    SkillSyncQueue,
    SkillSyncProcessor,
    SkillSyncCron,
  ],
  controllers: [SkillsController],
  exports: [SkillsService, ManifestValidator, SkillSyncQueue],
})
export class SkillsModule {}
