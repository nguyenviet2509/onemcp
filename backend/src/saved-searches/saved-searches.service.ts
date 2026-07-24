import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestUser } from '../common/user-request';
import { HybridSearchHit, SearchService } from '../search/search.service';
import { SaveSearchDto } from './dto/save-search.dto';
import { SavedSearch } from './saved-search.entity';

@Injectable()
export class SavedSearchesService {
  constructor(
    @InjectRepository(SavedSearch) private readonly repo: Repository<SavedSearch>,
    private readonly searchService: SearchService,
  ) {}

  async create(user: RequestUser, dto: SaveSearchDto): Promise<SavedSearch> {
    const entity = this.repo.create({
      userId: user.id,
      name: dto.name,
      query: dto.query,
      filters: dto.filters ?? {},
      mode: dto.mode ?? 'hybrid',
    });
    return this.repo.save(entity);
  }

  list(user: RequestUser): Promise<SavedSearch[]> {
    return this.repo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
  }

  async delete(user: RequestUser, id: string): Promise<void> {
    const saved = await this.repo.findOne({ where: { id } });
    if (!saved) throw new NotFoundException(`Saved search #${id} not found`);
    if (saved.userId !== user.id) throw new ForbiddenException('Not your saved search');
    await this.repo.remove(saved);
  }

  // Re-run the stored query using hybrid SearchService.
  async run(user: RequestUser, id: string): Promise<HybridSearchHit[]> {
    const saved = await this.repo.findOne({ where: { id } });
    if (!saved) throw new NotFoundException(`Saved search #${id} not found`);
    if (saved.userId !== user.id) throw new ForbiddenException('Not your saved search');

    const filters = saved.filters ?? {};
    return this.searchService.hybrid(user, {
      query: saved.query,
      mode: saved.mode as 'hybrid' | 'fts' | 'semantic',
      spaceId: filters.spaceId,
      templateKey: filters.templateKey,
      tags: filters.tags,
    });
  }
}
