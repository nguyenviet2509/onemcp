import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchModule } from '../search/search.module';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';
import { SavedSearch } from './saved-search.entity';

// SavedSearchesModule: user-scoped saved query CRUD + run-on-demand.
// SearchModule imported to inject SearchService for the /run endpoint.
@Module({
  imports: [TypeOrmModule.forFeature([SavedSearch]), SearchModule],
  providers: [SavedSearchesService],
  controllers: [SavedSearchesController],
})
export class SavedSearchesModule {}
