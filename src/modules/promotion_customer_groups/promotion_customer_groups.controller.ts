import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PromotionCustomerGroupsService } from './promotion_customer_groups.service';
import { CreatePromotionCustomerGroupDto } from './dto/create-promotion-customer-group.dto';
import { UpdatePromotionCustomerGroupDto } from './dto/update-promotion-customer-group.dto';

@ApiTags('promotion-customer-groups')
@Controller('promotion-customer-groups')
export class PromotionCustomerGroupsController {
  constructor(private readonly service: PromotionCustomerGroupsService) {}

  @Post()
  create(@Body() dto: CreatePromotionCustomerGroupDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromotionCustomerGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
