import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
// import { UpdateBannerDto } from './dto/update-banner.dto';

@Controller('banners')
export class BannersController {
  constructor(private readonly service: BannersService) {}

  @Post()
  create(@Body() dto: CreateBannerDto) {
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
  // update(@Param('id') id: number, @Body() dto: UpdateBannerDto) {
  //   return this.service.update(+id, dto);
  // }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
