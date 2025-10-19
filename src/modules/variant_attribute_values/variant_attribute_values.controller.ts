import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VariantAttributeValuesService } from './variant_attribute_values.service';
import { CreateVariantAttributeValueDto } from './dto/create-variant_attribute_value.dto';
import { UpdateVariantAttributeValueDto } from './dto/update-variant_attribute_value.dto';

@ApiTags('variant-attribute-values')
@Controller('variant-attribute-values')
export class VariantAttributeValuesController {
  constructor(private readonly service: VariantAttributeValuesService) {}

  @Post()
  create(@Body() dto: CreateVariantAttributeValueDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVariantAttributeValueDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
