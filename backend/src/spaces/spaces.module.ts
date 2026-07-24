import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Space } from './space.entity';
import { SpacesService } from './spaces.service';
import { SpacesController } from './spaces.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Space])],
  providers: [SpacesService],
  controllers: [SpacesController],
  exports: [SpacesService],
})
export class SpacesModule {}
