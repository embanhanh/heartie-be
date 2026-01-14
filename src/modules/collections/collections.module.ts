import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { Collection } from './entities/collection.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [TypeOrmModule.forFeature([Collection]), UploadModule],
  providers: [CollectionsService],
  controllers: [CollectionsController],
  exports: [CollectionsService, TypeOrmModule],
})
export class CollectionsModule {}
