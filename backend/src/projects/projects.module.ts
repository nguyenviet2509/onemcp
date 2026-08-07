import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectsService } from './projects.service';

// Controller added in P6 (approve/reject/CRUD endpoints).
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
