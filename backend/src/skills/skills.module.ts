import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillLoadEvent } from './entities/skill-load-event.entity';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';
import { ManifestValidator } from './manifest-validator';

@Module({
  imports: [TypeOrmModule.forFeature([Skill, SkillVersion, SkillLoadEvent])],
  providers: [SkillsService, ManifestValidator],
  controllers: [SkillsController],
  exports: [SkillsService, ManifestValidator],
})
export class SkillsModule {}
