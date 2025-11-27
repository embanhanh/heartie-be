import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attribute } from './entities/attribute.entity';
import { AttributesService } from './attributes.service';
import { AttributesController } from './attributes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Attribute])],
  controllers: [AttributesController],
  providers: [AttributesService],
  exports: [TypeOrmModule],
})
export class AttributesModule {}
