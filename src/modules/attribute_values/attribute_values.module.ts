import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttributeValuesController } from './attribute_values.controller';
import { AttributeValuesService } from './attribute_values.service';
import { Attribute } from '../attributes/entities/attribute.entity';
import { AttributeValue } from './entities/attribute-value.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttributeValue, Attribute])],
  controllers: [AttributeValuesController],
  providers: [AttributeValuesService],
  exports: [TypeOrmModule],
})
export class AttributeValuesModule {}
