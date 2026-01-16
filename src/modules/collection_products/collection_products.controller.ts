import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CollectionProductsService } from './collection_products.service';
import { CreateCollectionProductDto } from './dto/create-collection-product.dto';
import { UpdateCollectionProductDto } from './dto/update-collection-product.dto';
import { CollectionProductsQueryDto } from './dto/collection-products-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Collection Products')
@Controller('collection-products')
@ApiBearerAuth()
export class CollectionProductsController {
  constructor(private readonly service: CollectionProductsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Thêm sản phẩm vào bộ sưu tập' })
  create(@Body() dto: CreateCollectionProductDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách sản phẩm thuộc bộ sưu tập' })
  findAll(@Query() query: CollectionProductsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết liên kết bộ sưu tập - sản phẩm' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Cập nhật liên kết bộ sưu tập - sản phẩm' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCollectionProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Xóa sản phẩm khỏi bộ sưu tập' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
