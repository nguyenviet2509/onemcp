import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { SearchModule } from '../search/search.module';
import { Skill } from '../skills/entities/skill.entity';
import { SkillVersion } from '../skills/entities/skill-version.entity';
import { SkillsModule } from '../skills/skills.module';
import { SpacesModule } from '../spaces/spaces.module';
import { TemplatesModule } from '../templates/templates.module';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';

// Phase 1C: import SpacesModule + TemplatesModule for submit_artifact validation.
@Module({
  imports: [
    SkillsModule,
    ArtifactsModule,
    SearchModule,
    SpacesModule,
    TemplatesModule,
    TypeOrmModule.forFeature([Skill, SkillVersion]),
  ],
  providers: [McpToolsService],
  controllers: [McpController],
})
export class McpModule {}
