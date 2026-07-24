import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminCidrGuard } from '../access/admin-cidr.guard';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { createTemplateSchema, updateTemplateSchema } from './dto/create-template.dto';
import { TemplatesService } from './templates.service';

@Controller()
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  // --- Public read endpoints ---

  // GET /api/templates?department=<slug>
  @Get('templates')
  list(@CurrentUser() user: RequestUser | undefined, @Query('department') department?: string) {
    if (!user) throw new UnauthorizedException();
    return this.templates.listActive(department);
  }

  @Get('templates/:key')
  getByKey(@CurrentUser() user: RequestUser | undefined, @Param('key') key: string) {
    if (!user) throw new UnauthorizedException();
    return this.templates.getByKey(key);
  }

  // --- Admin CRUD (ADMIN_ALLOW_CIDR guard) ---

  @Post('admin/templates')
  @UseGuards(AdminCidrGuard)
  create(@Body() body: unknown) {
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.templates.create(parsed.data);
  }

  @Patch('admin/templates/:key')
  @UseGuards(AdminCidrGuard)
  update(@Param('key') key: string, @Body() body: unknown) {
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.templates.update(key, parsed.data);
  }

  @Delete('admin/templates/:key')
  @UseGuards(AdminCidrGuard)
  remove(@Param('key') key: string) {
    return this.templates.remove(key);
  }
}
