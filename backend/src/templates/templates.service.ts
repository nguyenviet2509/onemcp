import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(@InjectRepository(Template) private readonly repo: Repository<Template>) {}

  // List active templates, optionally filtered by department slug in department_scope.
  listActive(departmentSlug?: string): Promise<Template[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.active = true')
      .orderBy('t.key', 'ASC');

    if (departmentSlug) {
      // Match if scope is empty (global) OR contains this dept slug.
      qb.andWhere(
        "(array_length(t.department_scope, 1) IS NULL OR t.department_scope = '{}' OR :slug = ANY(t.department_scope))",
        { slug: departmentSlug },
      );
    }

    return qb.getMany();
  }

  async getByKey(key: string): Promise<Template> {
    const t = await this.repo.findOne({ where: { key } });
    if (!t) throw new NotFoundException(`Template '${key}' không tồn tại`);
    return t;
  }

  async create(dto: CreateTemplateDto): Promise<Template> {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Template key '${dto.key}' đã tồn tại`);
    const tpl = this.repo.create({
      key: dto.key,
      label: dto.label,
      description: dto.description ?? null,
      schema: dto.schema,
      uiHints: dto.uiHints ?? null,
      departmentScope: dto.departmentScope,
      active: dto.active,
    });
    return this.repo.save(tpl);
  }

  async update(key: string, dto: UpdateTemplateDto): Promise<Template> {
    const tpl = await this.getByKey(key);
    Object.assign(tpl, {
      ...(dto.label !== undefined && { label: dto.label }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.schema !== undefined && { schema: dto.schema }),
      ...(dto.uiHints !== undefined && { uiHints: dto.uiHints }),
      ...(dto.departmentScope !== undefined && { departmentScope: dto.departmentScope }),
      ...(dto.active !== undefined && { active: dto.active }),
      updatedAt: new Date(),
    });
    return this.repo.save(tpl);
  }

  async remove(key: string): Promise<void> {
    const tpl = await this.getByKey(key);
    await this.repo.remove(tpl);
  }
}
