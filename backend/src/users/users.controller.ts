import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';

@Controller()
export class UsersController {
  @Get('me')
  me(@CurrentUser() user?: RequestUser) {
    if (!user) throw new UnauthorizedException('No identity — kiểm tra X-Onemcp-User header');
    return {
      id: user.id,
      username: user.username,
      roles: user.roles,
      departmentId: user.departmentId,
      status: user.status,
      identityMode: 'v1-trust-header',
    };
  }
}
