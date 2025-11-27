import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CartItemsService } from './cart-items.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { Request } from 'express';

function getUserId(req: Request): number {
  const user = req.user as { sub: number };
  return user?.sub ?? 0;
}

@ApiTags('cart-items')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('cart-items')
export class CartItemsController {
  constructor(private readonly service: CartItemsService) {}

  @Post('me')
  addItem(@Req() req: Request, @Body() dto: AddCartItemDto) {
    return this.service.addItem(getUserId(req), dto);
  }

  @Patch('me/:itemId')
  updateItem(@Req() req: Request, @Param('itemId') itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.service.updateItem(getUserId(req), Number(itemId), dto);
  }

  @Delete('me/:itemId')
  removeItem(@Req() req: Request, @Param('itemId') itemId: string) {
    return this.service.removeItem(getUserId(req), Number(itemId));
  }

  @Delete('me')
  clear(@Req() req: Request) {
    return this.service.clear(getUserId(req));
  }
}
