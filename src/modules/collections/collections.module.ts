import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { Collection } from './entities/collection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Collection])],
  providers: [CollectionsService],
  controllers: [CollectionsController],
  exports: [CollectionsService, TypeOrmModule],
})
export class CollectionsModule {}
