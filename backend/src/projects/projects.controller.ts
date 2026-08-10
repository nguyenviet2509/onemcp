import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { CreateProjectDto } from './dto/create-project.dto';
import { RejectProjectDto } from './dto/reject-project.dto';
import { Project } from './entities/project.entity';
import { ProjectsService } from './projects.service';

// Multi-project registry REST API (P6).
// Auth: req.user comes from TrustUserMiddleware / ApiKeyMiddleware.
// Admin gate performed inside service (isAdmin check on roles).
@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  private mustAuth(user: RequestUser | undefined): RequestUser {
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Post()
  async register(
    @CurrentUser() user: RequestUser | undefined,
    @Body() dto: CreateProjectDto,
  ): Promise<{ project: Omit<Project, 'webhookSecret'>; webhookSecret: string }> {
    const u = this.mustAuth(user);
    const { project, webhookSecret } = await this.projects.register(dto, u);
    return { project: this.mask(project), webhookSecret };
  }

  @Get()
  async list(@CurrentUser() user: RequestUser | undefined): Promise<Omit<Project, 'webhookSecret'>[]> {
    const u = this.mustAuth(user);
    const rows = await this.projects.list(u);
    return rows.map((r) => this.mask(r));
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Omit<Project, 'webhookSecret'>> {
    const u = this.mustAuth(user);
    return this.mask(await this.projects.detail(id, u));
  }

  @Patch(':id/approve')
  async approve(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Omit<Project, 'webhookSecret'>> {
    return this.mask(await this.projects.approve(id, this.mustAuth(user)));
  }

  @Patch(':id/reject')
  async reject(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectProjectDto,
  ): Promise<Omit<Project, 'webhookSecret'>> {
    return this.mask(await this.projects.reject(id, this.mustAuth(user), dto?.reason));
  }

  @Patch(':id/suspend')
  async suspend(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Omit<Project, 'webhookSecret'>> {
    return this.mask(await this.projects.suspend(id, this.mustAuth(user)));
  }

  @Post(':id/regen-secret')
  async regen(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ project: Omit<Project, 'webhookSecret'>; webhookSecret: string }> {
    const u = this.mustAuth(user);
    const { project, webhookSecret } = await this.projects.regenerateSecret(id, u);
    return { project: this.mask(project), webhookSecret };
  }

  // Never leak webhookSecret in listing/detail responses (shown once on create + regen).
  private mask(p: Project): Omit<Project, 'webhookSecret'> {
    const { webhookSecret: _ignored, ...rest } = p;
    void _ignored;
    return rest;
  }
}
