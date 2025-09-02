import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-addresse.dto';
import { UpdateAddresseDto } from './dto/update-addresse.dto';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly service: AddressesService) {}

  @Post()
  create(@Body() dto: CreateAddressDto) {
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

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateAddresseDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
