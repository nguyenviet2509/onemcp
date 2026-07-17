import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestUser } from '../common/user-request';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';

// Approve pending version → set thành current. Reject → mark rejected.
// Chỉ maintainer/dept-admin/super-admin trong CÙNG dept mới approve được (C1 mitigation).
@Injectable()
export class SkillApprovalService {
  constructor(
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
  ) {}

  private assertCanApprove(user: RequestUser) {
    const allowed = ['maintainer', 'dept-admin', 'super-admin'];
    if (!user.roles.some((r) => allowed.includes(r))) {
      throw new ForbiddenException('Approve chỉ dành cho maintainer / admin');
    }
  }

  async approve(user: RequestUser, skillName: string, versionId: number): Promise<SkillVersion> {
    this.assertCanApprove(user);
    const skill = await this.skills.findOne({
      where: { departmentId: user.departmentId, name: skillName },
    });
    if (!skill) throw new NotFoundException(`Skill "${skillName}" không tồn tại`);

    const version = await this.versions.findOne({ where: { id: versionId, skillId: skill.id } });
    if (!version) throw new NotFoundException(`Version ${versionId} không thuộc skill "${skillName}"`);
    if (version.status === 'rejected') {
      throw new BadRequestException('Version đã bị reject — không thể approve');
    }

    version.status = 'active';
    version.approvedAt = new Date();
    version.approvedBy = user.id;
    await this.versions.save(version);

    skill.currentVersionId = version.id;
    skill.updatedAt = new Date();
    await this.skills.save(skill);
    return version;
  }

  async reject(user: RequestUser, skillName: string, versionId: number): Promise<SkillVersion> {
    this.assertCanApprove(user);
    const skill = await this.skills.findOne({
      where: { departmentId: user.departmentId, name: skillName },
    });
    if (!skill) throw new NotFoundException(`Skill "${skillName}" không tồn tại`);
    const version = await this.versions.findOne({ where: { id: versionId, skillId: skill.id } });
    if (!version) throw new NotFoundException(`Version ${versionId} không thuộc skill`);
    if (version.status === 'active') {
      throw new BadRequestException('Version đang active — không thể reject; tạo version mới');
    }
    version.status = 'rejected';
    await this.versions.save(version);
    return version;
  }
}
