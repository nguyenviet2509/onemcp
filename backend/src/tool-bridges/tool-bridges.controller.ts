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
import { createBridgeSchema, updateBridgeSchema } from './dto/bridge.dto';
import { ToolBridgesService } from './tool-bridges.service';

function requireToolBridgeAdmin(user: RequestUser | undefined): void {
  if (!user) throw new UnauthorizedException('unauthenticated');
  const allowed = user.roles.some((r) => r === 'super-admin' || r === 'dept-admin');
  if (!allowed) throw new ForbiddenException('onemcp:admin.tool-bridges permission required');
}

@Controller('api/admin/tool-bridges')
export class ToolBridgesController {
  constructor(private readonly svc: ToolBridgesService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: RequestUser | undefined, @Body() body: unknown) {
    requireToolBridgeAdmin(user);
    const parsed = createBridgeSchema.safeParse(body);
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
    const parsed = updateBridgeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.update(id, parsed.data);
  }

  // Soft-disable — preserves FK references + audit history.
  @Delete(':id')
  @HttpCode(204)
  async disable(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    requireToolBridgeAdmin(user);
    await this.svc.disable(id);
  }
}
