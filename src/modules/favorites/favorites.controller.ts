import { Controller, Post, Body, UseGuards, Req, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { User } from '../users/entities/user.entity';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('toggle')
  async toggleFavorite(@Req() req: Request, @Body('productId') productId: number) {
    const user = req.user as User;
    return this.favoritesService.toggleFavorite(user.id, productId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getFavorites(@Req() req: Request) {
    const user = req.user as User;
    return this.favoritesService.getFavorites(user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('check/:productId')
  async checkIsFavorite(@Req() req: Request, @Param('productId', ParseIntPipe) productId: number) {
    const user = req.user as User;
    return { isFavorite: await this.favoritesService.checkIsFavorite(user.id, productId) };
  }
}
