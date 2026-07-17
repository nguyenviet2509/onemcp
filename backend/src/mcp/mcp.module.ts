import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Skill } from '../skills/entities/skill.entity';
import { SkillVersion } from '../skills/entities/skill-version.entity';
import { SkillsModule } from '../skills/skills.module';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';

@Module({
  imports: [SkillsModule, TypeOrmModule.forFeature([Skill, SkillVersion])],
  providers: [McpToolsService],
  controllers: [McpController],
})
export class McpModule {}
