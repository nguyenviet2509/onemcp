import { BadRequestException, Controller, Get, Logger, Query, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { SpacesService } from '../spaces/spaces.service';
import { SearchEntityKind, SearchMode, SearchService } from './search.service';

const VALID_MODES = new Set<SearchMode>(['hybrid', 'fts', 'semantic']);

@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly search: SearchService,
    private readonly spaces: SpacesService,
  ) {}

  // Rate limit 30/min per IP — search can be expensive on wide queries.
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async run(
    @CurrentUser() user: RequestUser | undefined,
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
    // RT-3: explicit service hint — validated against allowlist, silently ignored if unknown.
    @Query('service') serviceRaw?: string,
    // Phase 2C: hybrid search params
    @Query('mode') modeRaw?: string,
    @Query('space') spaceSlug?: string,
    @Query('template_key') templateKey?: string,
    @Query('tags') tagsRaw?: string, // comma-separated
    @Query('dept') _deptSlug?: string, // reserved — dept filter via user.departmentId for now
  ) {
    if (!user) throw new UnauthorizedException();

    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    // Determine if this is a hybrid search request (mode param present, or new filter params used)
    const hasHybridParams = modeRaw || spaceSlug || templateKey || tagsRaw;

    if (hasHybridParams) {
      return this.runHybrid(user, q, modeRaw, spaceSlug, templateKey, tagsRaw, parsedLimit);
    }

    // Legacy FTS path — unchanged behaviour for old callers
    const service = this.resolveServiceParam(serviceRaw);
    return this.search.search(user, {
      q: q ?? '',
      kind: (kind as SearchEntityKind) ?? 'all',
      limit: parsedLimit,
      service,
    });
  }

  private async runHybrid(
    user: RequestUser,
    q: string | undefined,
    modeRaw: string | undefined,
    spaceSlug: string | undefined,
    templateKey: string | undefined,
    tagsRaw: string | undefined,
    limit: number | undefined,
  ) {
    if (!q?.trim()) throw new BadRequestException('q is required');

    // Validate mode
    const mode = (modeRaw?.toLowerCase() as SearchMode | undefined) ?? 'hybrid';
    if (!VALID_MODES.has(mode)) {
      throw new BadRequestException(`mode must be one of: ${[...VALID_MODES].join(', ')}`);
    }

    // Resolve space slug → id
    let spaceId: string | undefined;
    if (spaceSlug) {
      try {
        const space = await this.spaces.findBySlug(spaceSlug);
        spaceId = space.id;
      } catch {
        throw new BadRequestException(`space "${spaceSlug}" not found`);
      }
    }

    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    return this.search.hybrid(user, {
      query: q,
      mode,
      spaceId,
      templateKey,
      tags,
      limit,
    });
  }

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
