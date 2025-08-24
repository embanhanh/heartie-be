import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { PromotionalComboDetailsService } from './promotional_combo_details.service';
import { CreatePromotionalComboDetailDto } from './dto/create-promotional_combo_detail.dto';
// import { UpdatePromotionalComboDetailDto } from './dto/update-promotional_combo_detail.dto';

@Controller('promotional_combo_details')
export class PromotionalComboDetailsController {
  constructor(private readonly service: PromotionalComboDetailsService) {}

  @Post()
  create(@Body() dto: CreatePromotionalComboDetailDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(+id);
  }

  // @Put(':id')
  // update(@Param('id') id: number, @Body() dto: UpdatePromotionalComboDetailDto) {
  //   return this.service.update(+id, dto);
  // }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
