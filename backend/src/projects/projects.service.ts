import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';

// Stub — full CRUD + approve/reject in P6.
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
  ) {}

  findAll(): Promise<Project[]> {
    return this.repo.find();
  }

  findOne(id: number): Promise<Project | null> {
    return this.repo.findOneBy({ id });
  }
}
