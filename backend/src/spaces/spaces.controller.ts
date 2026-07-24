import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminCidrGuard } from '../access/admin-cidr.guard';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { createSpaceSchema, updateSpaceSchema } from './dto/create-space.dto';
import { SpacesService } from './spaces.service';

@Controller()
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  // --- Public read endpoints (any authenticated user) ---

  @Get('spaces')
  list(@CurrentUser() user: RequestUser | undefined) {
    if (!user) throw new UnauthorizedException();
    return this.spaces.findAll();
  }

  @Get('spaces/:slug')
  getBySlug(@CurrentUser() user: RequestUser | undefined, @Param('slug') slug: string) {
    if (!user) throw new UnauthorizedException();
    return this.spaces.findBySlug(slug);
  }

  @Get('departments/:deptId/spaces')
  listByDept(@CurrentUser() user: RequestUser | undefined, @Param('deptId') deptId: string) {
    if (!user) throw new UnauthorizedException();
    return this.spaces.findByDept(deptId);
  }

  // --- Admin CRUD (ADMIN_ALLOW_CIDR guard) ---

  @Post('admin/spaces')
  @UseGuards(AdminCidrGuard)
  create(@Body() body: unknown) {
    const parsed = createSpaceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.spaces.create(parsed.data);
  }

  @Patch('admin/spaces/:slug')
  @UseGuards(AdminCidrGuard)
  update(@Param('slug') slug: string, @Body() body: unknown) {
    const parsed = updateSpaceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.spaces.update(slug, parsed.data);
  }

  @Delete('admin/spaces/:slug')
  @UseGuards(AdminCidrGuard)
  remove(@Param('slug') slug: string) {
    return this.spaces.remove(slug);
  }
}
