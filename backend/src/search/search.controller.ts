import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { SearchEntityKind, SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  // Rate limit 30/min per IP — search có thể expensive khi query rộng.
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  run(
    @CurrentUser() user: RequestUser | undefined,
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.search.search(user, {
      q: q ?? '',
      kind: (kind as SearchEntityKind) ?? 'all',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
