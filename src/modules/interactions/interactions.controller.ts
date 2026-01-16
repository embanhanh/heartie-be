import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
// import { UpdateInteractionDto } from './dto/update-interaction.dto';

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly service: InteractionsService) {}

  @Post()
  create(@Body() dto: CreateInteractionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: number,
    @Query('type') type?: string,
  ) {
    return this.service.findAll({ page, limit, userId, type });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(+id);
  }

  // @Put(':id')
  // update(@Param('id') id: number, @Body() dto: UpdateInteractionDto) {
  //   return this.service.update(+id, dto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: number) {
  //   return this.service.remove(+id);
  // }
}
