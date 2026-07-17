import { Controller, Get, Logger, Query, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { SearchEntityKind, SearchService } from './search.service';

@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly search: SearchService) {}

  // Rate limit 30/min per IP — search có thể expensive khi query rộng.
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  run(
    @CurrentUser() user: RequestUser | undefined,
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
    // RT-3: explicit service hint. Validate ngay tại controller — nếu không trong allowlist,
    // silently ignore (không 400) để không break clients cũ.
    @Query('service') serviceRaw?: string,
  ) {
    if (!user) throw new UnauthorizedException();

    // Resolve và validate service param trước khi pass xuống SearchService.
    const service = this.resolveServiceParam(serviceRaw);

    return this.search.search(user, {
      q: q ?? '',
      kind: (kind as SearchEntityKind) ?? 'all',
      limit: limit ? parseInt(limit, 10) : undefined,
      service,
    });
  }

  // Validate ?service= param ngược lại KNOWN_SERVICES allowlist.
  // Nếu unknown service → return null (silently ignore) để không break clients.
  // RT-3: không throw 400 — boost là optional, không phải filter bắt buộc.
  private resolveServiceParam(raw: string | undefined): string | null {
    if (!raw || !raw.trim()) return null;
    const normalized = raw.trim().toLowerCase();
    const knownServices = this.search.getKnownServices();
    if (!knownServices.includes(normalized)) {
      if (process.env.SEARCH_DEBUG === '1') {
        this.logger.debug(`Unknown service param ignored: "${raw}"`);
      }
      return null;
    }
    return normalized;
  }
}
