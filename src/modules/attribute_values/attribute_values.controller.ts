import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttributeValuesService } from './attribute_values.service';
import { CreateAttributeValueDto } from './dto/create-attribute_value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute_value.dto';

@ApiTags('attribute-values')
@Controller('attribute-values')
export class AttributeValuesController {
  constructor(private readonly service: AttributeValuesService) {}

  @Post()
  create(@Body() dto: CreateAttributeValueDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAttributeValueDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
