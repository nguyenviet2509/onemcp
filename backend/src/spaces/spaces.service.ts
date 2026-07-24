import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Space } from './space.entity';
import { CreateSpaceDto, UpdateSpaceDto } from './dto/create-space.dto';

@Injectable()
export class SpacesService {
  constructor(@InjectRepository(Space) private readonly repo: Repository<Space>) {}

  findAll(): Promise<Space[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findBySlug(slug: string): Promise<Space> {
    const space = await this.repo.findOne({ where: { slug } });
    if (!space) throw new NotFoundException(`Space '${slug}' không tồn tại`);
    return space;
  }

  findByDept(departmentId: string): Promise<Space[]> {
    return this.repo.find({ where: { departmentId }, order: { name: 'ASC' } });
  }

  async create(dto: CreateSpaceDto): Promise<Space> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Space slug '${dto.slug}' đã tồn tại`);
    const space = this.repo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      departmentId: dto.departmentId ?? null,
      icon: dto.icon ?? null,
      visibility: dto.visibility,
    });
    return this.repo.save(space);
  }

  async update(slug: string, dto: UpdateSpaceDto): Promise<Space> {
    const space = await this.findBySlug(slug);
    Object.assign(space, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
      updatedAt: new Date(),
    });
    return this.repo.save(space);
  }

  async remove(slug: string): Promise<void> {
    const space = await this.findBySlug(slug);
    await this.repo.remove(space);
  }
}
