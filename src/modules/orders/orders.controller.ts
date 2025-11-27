import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';
import { PaginationOptionsDto } from '../../common/dto/pagination.dto';

@Controller('orders')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Create a new order' })
  create(@Body() dto: CreateOrderDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER, UserRole.BRANCH_MANAGER)
  findAll(@Query() pagination: PaginationOptionsDto) {
    return this.service.findAll(pagination);
  }

  @Get('status/:orderNumber')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SHOP_OWNER)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get order status by order number' })
  getStatus(
    @Req() req: Request & { user?: { sub: number } },
    @Param('orderNumber') orderNumber: string,
  ) {
    const user = req.user as { sub: number };
    return this.service.getOrderStatus(orderNumber, user.sub);
  }

  @Get('recent')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Get recent orders for the current user' })
  @UseGuards(AuthGuard('jwt'))
  getRecentOrders(@Req() req: Request & { user?: { sub: number } }) {
    const user = req.user as { sub: number };
    return this.service.listRecentOrders(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SHOP_OWNER)
  findOne(@Param('id') id: number) {
    return this.service.findOne(+id);
  }

  @Put(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  update(@Param('id') id: number, @Body() dto: UpdateOrderDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
