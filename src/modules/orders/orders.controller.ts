import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

type AuthenticatedUser = {
  id: number;
  role: UserRole;
};

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Controller('orders')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Create a new order' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    const user = req.user;

    if (user && user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Only customers can create orders');
    }

    return this.service.create(dto, user?.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER, UserRole.BRANCH_MANAGER)
  findAll(@Query() query: OrdersQueryDto) {
    return this.service.findAll(query);
  }

  @Get('status/:orderNumber')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SHOP_OWNER)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get order status by order number' })
  getStatus(
    @Req() req: Request & { user?: { id: number } },
    @Param('orderNumber') orderNumber: string,
  ) {
    const user = req.user as { id: number };
    return this.service.getOrderStatus(orderNumber, user.id);
  }

  @Get('recent')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Get recent orders for the current user' })
  @UseGuards(AuthGuard('jwt'))
  getRecentOrders(@Req() req: Request & { user?: { id: number } }) {
    const user = req.user as { id: number };
    return this.service.listRecentOrders(user.id);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SHOP_OWNER)
  @UseGuards(AuthGuard('jwt'))
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: number) {
    const user = this.getRequestUser(req);
    return this.service.findOne(+id, user);
  }

  @Patch(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: number,
    @Body() dto: UpdateOrderDto,
  ) {
    const user = this.getRequestUser(req);
    if (user.role === UserRole.CUSTOMER) {
      await this.service.ensureOrderBelongsToUserOrFail(+id, user.id);
    }
    return this.service.update(+id, dto, user);
  }

  @Post(':id/cancel')
  @Roles(UserRole.CUSTOMER)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cancel an order (customers only)' })
  async cancelOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: number,
    @Body() dto: CancelOrderDto,
  ) {
    const user = this.getRequestUser(req);
    const order = await this.service.findOne(+id, user);
    return this.service.requestCancellation(order.orderNumber ?? '', user, dto.cancellationReason);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }

  private getRequestUser(req: AuthenticatedRequest): AuthenticatedUser {
    if (!req.user || typeof req.user.id !== 'number') {
      throw new UnauthorizedException('Authenticated user context is required');
    }

    return req.user;
  }
}
