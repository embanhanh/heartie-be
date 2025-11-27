import { Controller, Post, Body } from '@nestjs/common';
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

  // @Get()
  // findAll() {
  //   return this.service.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: number) {
  //   return this.service.findOne(+id);
  // }

  // @Put(':id')
  // update(@Param('id') id: number, @Body() dto: UpdateInteractionDto) {
  //   return this.service.update(+id, dto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: number) {
  //   return this.service.remove(+id);
  // }
}
