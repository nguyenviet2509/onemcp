import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { SkillApprovalService } from './skill-approval.service';
import { SkillsService } from './skills.service';
import { SkillSyncQueue } from './sync/skill-sync.queue';

@Controller('skills')
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly approvals: SkillApprovalService,
    private readonly syncQueue: SkillSyncQueue,
  ) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser | undefined,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.skills.list(user, { tag, q });
  }

  @Get(':name')
  detail(@CurrentUser() user: RequestUser | undefined, @Param('name') name: string) {
    if (!user) throw new UnauthorizedException();
    return this.skills.findByName(user, name);
  }

  @Get(':name/versions')
  versions(@CurrentUser() user: RequestUser | undefined, @Param('name') name: string) {
    if (!user) throw new UnauthorizedException();
    return this.skills.listVersions(user, name);
  }

  // Rate limit 20 req/min per IP (C1 mitigation — chống mass approve).
  @Post(':name/versions/:id/approve')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  approve(
    @CurrentUser() user: RequestUser | undefined,
    @Param('name') name: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.approvals.approve(user, name, id);
  }

  @Post(':name/versions/:id/reject')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  reject(
    @CurrentUser() user: RequestUser | undefined,
    @Param('name') name: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.approvals.reject(user, name, id);
  }

  // Manual re-sync trigger (dev tool + fallback UI action).
  @Post('sync')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(202)
  async triggerSync(@CurrentUser() user: RequestUser | undefined) {
    if (!user) throw new UnauthorizedException();
    const allowed = ['maintainer', 'dept-admin', 'super-admin'];
    if (!user.roles.some((r) => allowed.includes(r))) {
      throw new UnauthorizedException('Chỉ maintainer/admin trigger được sync');
    }
    const jobId = await this.syncQueue.enqueue({ trigger: 'manual' });
    return { accepted: true, jobId };
  }
}
