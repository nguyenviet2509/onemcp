import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { createUpstreamSchema, updateUpstreamSchema } from './dto/upstream.dto';
import { ToolUpstreamsService } from './tool-upstreams.service';

// Inline admin check — matches existing codebase pattern (audit.controller.ts).
// Requires super-admin or dept-admin role; no RolesGuard decorator in this codebase.
function requireToolBridgeAdmin(user: RequestUser | undefined): void {
  if (!user) throw new UnauthorizedException('unauthenticated');
  const allowed = user.roles.some((r) => r === 'super-admin' || r === 'dept-admin');
  if (!allowed) throw new ForbiddenException('onemcp:admin.tool-bridges permission required');
}

@Controller('api/admin/tool-upstreams')
export class ToolUpstreamsController {
  constructor(private readonly svc: ToolUpstreamsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: RequestUser | undefined, @Body() body: unknown) {
    requireToolBridgeAdmin(user);
    const parsed = createUpstreamSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.create(parsed.data);
  }

  @Get()
  list(@CurrentUser() user: RequestUser | undefined) {
    requireToolBridgeAdmin(user);
    return this.svc.list();
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    requireToolBridgeAdmin(user);
    return this.svc.get(id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    requireToolBridgeAdmin(user);
    const parsed = updateUpstreamSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.update(id, parsed.data);
  }

  // Soft-disable — no hard-delete (FK integrity + audit history).
  @Delete(':id')
  @HttpCode(204)
  async disable(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    requireToolBridgeAdmin(user);
    await this.svc.disable(id);
  }
}
