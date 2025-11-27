import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { OrderProductDetailsService } from './order_product_details.service';
import { CreateOrderProductDetailDto } from './dto/create-order_product_detail.dto';
// import { UpdateOrderProductDetailDto } from './dto/update-order_product_detail.dto';

@Controller('order_product_details')
export class OrderProductDetailsController {
  constructor(private readonly service: OrderProductDetailsService) {}

  @Post()
  create(@Body() dto: CreateOrderProductDetailDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // @Get(':id')
  // findOne(@Param('id') id: number) {
  //   return this.service.findOne(+id);
  // }

  // @Put(':id')
  // update(@Param('id') id: number, @Body() dto: UpdateOrderProductDetailDto) {
  //   return this.service.update(+id, dto);
  // }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
