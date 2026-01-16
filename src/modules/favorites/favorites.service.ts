import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private favoritesRepository: Repository<Favorite>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async toggleFavorite(userId: number, productId: number): Promise<{ isFavorite: boolean }> {
    const existingFavorite = await this.favoritesRepository.findOne({
      where: {
        user: { id: userId },
        product: { id: productId },
      },
    });

    if (existingFavorite) {
      await this.favoritesRepository.remove(existingFavorite);
      return { isFavorite: false };
    } else {
      const product = await this.productsRepository.findOne({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const favorite = this.favoritesRepository.create({
        user: { id: userId },
        product: { id: productId },
      });

      try {
        await this.favoritesRepository.save(favorite);
      } catch (error) {
        // Handle race conditions where double click might cause unique constraint violation
        if ((error as { code: string }).code === '23505') {
          // Postgres unique_violation
          return { isFavorite: true };
        }
        throw error;
      }
      return { isFavorite: true };
    }
  }

  async getFavorites(userId: number): Promise<Favorite[]> {
    return this.favoritesRepository.find({
      where: { user: { id: userId } },
      relations: ['product', 'product.variants'], // Load product details
      order: { createdAt: 'DESC' },
    });
  }

  async checkIsFavorite(userId: number, productId: number): Promise<boolean> {
    const count = await this.favoritesRepository.count({
      where: {
        user: { id: userId },
        product: { id: productId },
      },
    });
    return count > 0;
  }
}
