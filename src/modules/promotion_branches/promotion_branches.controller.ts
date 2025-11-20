import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PromotionBranchesService } from './promotion_branches.service';
import { CreatePromotionBranchDto } from './dto/create-promotion-branch.dto';
import { UpdatePromotionBranchDto } from './dto/update-promotion-branch.dto';

@ApiTags('promotion-branches')
@Controller('promotion-branches')
export class PromotionBranchesController {
  constructor(private readonly service: PromotionBranchesService) {}

  @Post()
  create(@Body() dto: CreatePromotionBranchDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromotionBranchDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
