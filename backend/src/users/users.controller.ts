import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentUser } from '../access/current-user.decorator';
import { normalizeIp, parseCidrList } from '../access/cidr-parser';
import { RequestUser } from '../common/user-request';
import { UsersService } from './users.service';
import { AuthedRequest } from '../common/user-request';
import CIDRMatcher from 'cidr-matcher';

const ensureUserSchema = z.object({
  email: z
    .string()
    .email()
    .refine((e) => e.trim().toLowerCase().endsWith('@inet.vn'), {
      message: 'Only @inet.vn email addresses are accepted',
    }),
});

@Controller()
export class UsersController {
  private readonly bridgeCidr: CIDRMatcher;

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {
    // Bridge auto-provision accepted from TRUSTED_PROXY_CIDR (same subnet as bridge/Caddy).
    this.bridgeCidr = parseCidrList(this.config.get<string>('TRUSTED_PROXY_CIDR', '127.0.0.1/32'));
  }

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

  // POST /api/users/ensure — idempotent upsert by @inet.vn email for bridge auto-provision.
  // Only accepted from bridge CIDR (TRUSTED_PROXY_CIDR). Returns { username, role, created }.
  @Post('users/ensure')
  @HttpCode(200)
  async ensure(@Req() req: AuthedRequest, @Body() body: unknown) {
    const clientIp = normalizeIp(req.clientIp ?? req.ip ?? req.socket?.remoteAddress ?? '');
    if (!this.bridgeCidr.contains(clientIp)) {
      throw new ForbiddenException('users/ensure chỉ chấp nhận từ bridge CIDR');
    }

    const parsed = ensureUserSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    try {
      return await this.users.ensureByEmail(parsed.data.email);
    } catch (err) {
      throw new BadRequestException(String(err));
    }
  }
}
