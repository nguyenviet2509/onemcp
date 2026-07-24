import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { SpacesModule } from '../spaces/spaces.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

// Phase 2C: EmbeddingsModule → EMBEDDING_PROVIDER token for SearchService vector branch.
// SpacesModule → SpacesService for slug→id resolution in SearchController.
// MetricsModule is @Global() — no explicit import needed.
@Module({
  imports: [EmbeddingsModule, SpacesModule],
  providers: [SearchService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
