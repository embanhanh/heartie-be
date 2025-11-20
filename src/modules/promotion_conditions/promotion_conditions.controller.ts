import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PromotionConditionsService } from './promotion_conditions.service';
import { CreatePromotionConditionDto } from './dto/create-promotion-condition.dto';
import { UpdatePromotionConditionDto } from './dto/update-promotion-condition.dto';

@ApiTags('promotion-conditions')
@Controller('promotion-conditions')
export class PromotionConditionsController {
  constructor(private readonly service: PromotionConditionsService) {}

  @Post()
  create(@Body() dto: CreatePromotionConditionDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromotionConditionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
