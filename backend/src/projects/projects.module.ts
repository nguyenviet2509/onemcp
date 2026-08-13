import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../common/crypto/crypto.module';
import { Project } from './entities/project.entity';
import { ProjectOauthController } from './oauth/project-oauth.controller';
import { ProjectOauthService } from './oauth/project-oauth.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), CryptoModule],
  providers: [ProjectsService, ProjectOauthService],
  controllers: [ProjectsController, ProjectOauthController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
