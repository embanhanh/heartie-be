import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CartsService } from './carts.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@ApiTags('carts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('carts')
export class CartsController {
  constructor(private readonly service: CartsService) {}

  @Get('me')
  getMyCart(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.service.getMyCart(user.id);
  }

  // Carts module only exposes get-my-cart; item operations are in cart-items module
}
