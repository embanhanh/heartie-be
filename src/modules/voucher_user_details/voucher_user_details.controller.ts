import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { VoucherUserDetailsService } from './voucher_user_details.service';
import { CreateVoucherUserDetailDto } from './dto/create-voucher_user_detail.dto';
// import { UpdateVoucherUserDetailDto } from './dto/update-voucher_user_detail.dto';

@Controller('voucher_user_details')
export class VoucherUserDetailsController {
  constructor(private readonly service: VoucherUserDetailsService) {}

  @Post()
  create(@Body() dto: CreateVoucherUserDetailDto) {
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
  // update(@Param('id') id: number, @Body() dto: UpdateVoucherUserDetailDto) {
  //   return this.service.update(+id, dto);
  // }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
