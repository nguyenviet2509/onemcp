import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';

// V1 pilot chỉ Kỹ thuật. Cache default dept id để middleware lookup nhanh.
@Injectable()
export class DepartmentsService implements OnModuleInit {
  private readonly log = new Logger(DepartmentsService.name);
  private defaultDeptId!: number;

  constructor(@InjectRepository(Department) private readonly repo: Repository<Department>) {}

  async onModuleInit(): Promise<void> {
    const dept = await this.repo.findOne({ where: { code: 'kythuat' } });
    if (!dept) {
      throw new Error('Default department "kythuat" not seeded — kiểm tra init migration');
    }
    this.defaultDeptId = dept.id;
    this.log.log(`Default department id=${dept.id} code=${dept.code}`);
  }

  getDefaultId(): number {
    return this.defaultDeptId;
  }

  async findByCode(code: string): Promise<Department> {
    const d = await this.repo.findOne({ where: { code } });
    if (!d) throw new NotFoundException(`Department ${code} không tồn tại`);
    return d;
  }
}
