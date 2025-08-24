import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
// import { UpdateRatingDto } from './dto/update-rating.dto';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly service: RatingsService) {}

  @Post()
  create(@Body() dto: CreateRatingDto) {
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
  // update(@Param('id') id: number, @Body() dto: UpdateRatingDto) {
  //   return this.service.update(+id, dto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: number) {
  //   return this.service.remove(+id);
  // }
}
