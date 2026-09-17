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
import { AuditLogService } from '../audit/audit-log.service';
import { z } from 'zod';
import { createBridgeSchema, updateBridgeSchema } from './dto/bridge.dto';

const testBridgeSchema = z.object({ args: z.record(z.unknown()).default({}) });
import { ToolBridgesService } from './tool-bridges.service';

function requireToolBridgeAdmin(user: RequestUser | undefined): void {
  if (!user) throw new UnauthorizedException('unauthenticated');
  const allowed = user.roles.some((r) => r === 'super-admin' || r === 'dept-admin');
  if (!allowed) throw new ForbiddenException('onemcp:admin.tool-bridges permission required');
}

@Controller('api/admin/tool-bridges')
export class ToolBridgesController {
  constructor(
    private readonly svc: ToolBridgesService,
    private readonly audit: AuditLogService,
  ) {}

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

  // Dry-run schema-only test — does NOT fetch upstream (no side-effect).
  @Post(':id/test')
  async dryRunTest(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    requireToolBridgeAdmin(user);
    const parsed = testBridgeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const result = await this.svc.dryRunTest(id, parsed.data.args);
    this.audit.record({ actor: user, action: 'tool.admin_dry_test', resourceType: 'tool_bridge', resourceId: id });
    return result;
  }

  // Soft-disable — preserves FK references + audit history.
  @Delete(':id')
  @HttpCode(204)
  async disable(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    requireToolBridgeAdmin(user);
    await this.svc.disable(id);
  }
}
