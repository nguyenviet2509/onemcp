import { Controller, Get, Param, Query, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

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
}
