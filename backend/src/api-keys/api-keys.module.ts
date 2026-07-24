import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './api-key.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyMiddleware } from './api-key.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  providers: [ApiKeysService, ApiKeyMiddleware],
  controllers: [ApiKeysController],
  exports: [ApiKeysService, ApiKeyMiddleware],
})
export class ApiKeysModule {}
