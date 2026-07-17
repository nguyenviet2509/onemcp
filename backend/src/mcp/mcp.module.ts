import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { SearchModule } from '../search/search.module';
import { Skill } from '../skills/entities/skill.entity';
import { SkillVersion } from '../skills/entities/skill-version.entity';
import { SkillsModule } from '../skills/skills.module';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';

@Module({
  imports: [SkillsModule, ArtifactsModule, SearchModule, TypeOrmModule.forFeature([Skill, SkillVersion])],
  providers: [McpToolsService],
  controllers: [McpController],
})
export class McpModule {}
