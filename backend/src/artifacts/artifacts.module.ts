import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';
import { Artifact } from './entities/artifact.entity';
import { ArtifactVersion } from './entities/artifact-version.entity';
import { RunbookLoadEvent } from './entities/runbook-load-event.entity';
import { RunbookEventsRetentionService } from './runbook-events-retention.service';
import { TemplateValidator } from './templates/template-validator';
import { TemplatesController } from './templates/templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Artifact, ArtifactVersion, RunbookLoadEvent])],
  providers: [ArtifactsService, TemplateValidator, RunbookEventsRetentionService],
  controllers: [ArtifactsController, TemplatesController],
  exports: [ArtifactsService, TemplateValidator],
})
export class ArtifactsModule {}
