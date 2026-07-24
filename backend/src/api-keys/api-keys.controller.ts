import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { ApiKeysService } from './api-keys.service';

const createApiKeySchema = z.object({
  label: z.string().min(1).max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  // POST /api/api-keys — create key, returns full key ONCE.
  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: RequestUser | undefined, @Body() body: unknown) {
    if (!user) throw new UnauthorizedException();
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.apiKeys.create(
      String(user.id),
      parsed.data.label ?? null,
      parsed.data.expiresInDays,
    );
  }

  // GET /api/api-keys — list own keys (prefix + metadata only, never hash).
  @Get()
  list(@CurrentUser() user: RequestUser | undefined) {
    if (!user) throw new UnauthorizedException();
    return this.apiKeys.list(String(user.id));
  }

  // DELETE /api/api-keys/:id — revoke own key.
  @Delete(':id')
  revoke(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    return this.apiKeys.revoke(String(user.id), id);
  }
}
