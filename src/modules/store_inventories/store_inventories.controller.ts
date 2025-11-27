import { Controller, Post, Body } from '@nestjs/common';
import { StoreInventoriesService } from './store_inventories.service';
import { CreateStoreInventoryDto } from './dto/create-store_inventorie.dto';
// import { UpdateStoreInventorieDto } from './dto/update-store_inventorie.dto';

@Controller('store_inventories')
export class StoreInventoriesController {
  constructor(private readonly service: StoreInventoriesService) {}

  @Post()
  create(@Body() dto: CreateStoreInventoryDto) {
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
  // update(@Param('id') id: number, @Body() dto: UpdateStoreInventorieDto) {
  //   return this.service.update(+id, dto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: number) {
  //   return this.service.remove(+id);
  // }
}
