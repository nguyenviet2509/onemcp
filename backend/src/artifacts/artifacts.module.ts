import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';
import { Artifact } from './entities/artifact.entity';
import { ArtifactVersion } from './entities/artifact-version.entity';
import { TemplateValidator } from './templates/template-validator';
import { TemplatesController } from './templates/templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Artifact, ArtifactVersion])],
  providers: [ArtifactsService, TemplateValidator],
  controllers: [ArtifactsController, TemplatesController],
  exports: [ArtifactsService, TemplateValidator],
})
export class ArtifactsModule {}
