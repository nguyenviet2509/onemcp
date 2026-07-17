import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { ArtifactType } from './artifact-type.enum';
import { ArtifactsService } from './artifacts.service';
import { reviewArtifactSchema, submitArtifactSchema, updateArtifactSchema } from './dto/submit-artifact.dto';

@Controller('artifacts')
export class ArtifactsController {
  constructor(private readonly artifacts: ArtifactsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser | undefined,
    @Query('type') type?: string,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.artifacts.list(user, {
      type: type as ArtifactType | undefined,
      tag,
      q,
      status: status as 'pending' | 'published' | 'rejected' | undefined,
    });
  }

  @Get(':id')
  detail(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    return this.artifacts.findOne(user, id);
  }

  @Get(':id/versions')
  versions(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    return this.artifacts.listVersions(user, id);
  }

  // Rate limit submit — 20/min per IP (chống flood).
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(201)
  create(@CurrentUser() user: RequestUser | undefined, @Body() body: unknown) {
    if (!user) throw new UnauthorizedException();
    const parsed = submitArtifactSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid artifact payload',
        errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    return this.artifacts.create(user, parsed.data);
  }

  // Update — tạo pending version mới với optimistic lock (expected_version_no).
  @Post(':id/versions')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(201)
  update(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    if (!user) throw new UnauthorizedException();
    const parsed = updateArtifactSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid update payload',
        errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    return this.artifacts.update(user, id, parsed.data);
  }

  // Review — approve/reject pending version. Rate limit 20/min.
  @Post(':id/review')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  review(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    if (!user) throw new UnauthorizedException();
    const parsed = reviewArtifactSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid review payload',
        errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    return this.artifacts.review(user, id, parsed.data);
  }
}
