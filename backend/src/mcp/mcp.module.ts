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
import { McpSdkServerFactory } from './mcp-sdk-server.factory';
import { McpSessionStore } from './mcp-session.store';
import { McpToolsService } from './mcp-tools.service';
import { StreamableHttpController } from './streamable-http.controller';
import { AuthorizationServerController } from './well-known/authorization-server.controller';
import { ProtectedResourceController } from './well-known/protected-resource.controller';

// Phase 1C: import SpacesModule + TemplatesModule for submit_artifact validation.
// Phase P1-streamable: add SDK server factory + session store + streamable controller.
// Phase P2-P3: `.well-known/oauth-authorization-server` + `oauth-protected-resource` metadata.
@Module({
  imports: [
    SkillsModule,
    ArtifactsModule,
    SearchModule,
    SpacesModule,
    TemplatesModule,
    TypeOrmModule.forFeature([Skill, SkillVersion]),
  ],
  providers: [McpToolsService, McpSdkServerFactory, McpSessionStore],
  controllers: [
    McpController,
    StreamableHttpController,
    AuthorizationServerController,
    ProtectedResourceController,
  ],
})
export class McpModule {}
