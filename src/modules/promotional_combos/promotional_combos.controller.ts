import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { PromotionalCombosService } from './promotional_combos.service';
import { CreatePromotionalComboDto } from './dto/create-promotional_combo.dto';
// import { UpdatePromotionalComboDto } from './dto/update-promotional_combo.dto';

@Controller('promotional_combos')
export class PromotionalCombosController {
  constructor(private readonly service: PromotionalCombosService) {}

  @Post()
  create(@Body() dto: CreatePromotionalComboDto) {
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
  // update(@Param('id') id: number, @Body() dto: UpdatePromotionalComboDto) {
  //   return this.service.update(+id, dto);
  // }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
