import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from '../cart_items/entities/cart-item.entity';

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart) private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private readonly itemRepo: Repository<CartItem>,
  ) {}

  async getOrCreateCart(userId: number): Promise<Cart> {
    const order: FindOptionsOrder<Cart> = {
      items: {
        id: 'ASC',
      },
    };

    let cart = await this.cartRepo.findOne({
      where: { userId },
      relations: [
        'items',
        'items.variant',
        'items.variant.product',
        'items.variant.inventories',
        'items.variant.attributeValues',
        'items.variant.attributeValues.attribute',
        'items.variant.attributeValues.attributeValue',
      ],
      order,
    });
    if (!cart) {
      const created = await this.cartRepo.save(this.cartRepo.create({ userId }));
      cart = await this.cartRepo.findOneOrFail({
        where: { id: created.id },
        relations: ['items', 'items.variant', 'items.variant.product'],
        order,
      });
    }

    cart.items ??= [];

    return cart;
  }

  async getMyCart(userId: number): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    return cart;
  }

  async findCartForCheckout(userId: number): Promise<Cart> {
    const cart = await this.cartRepo.findOne({
      where: { userId },
      relations: ['items', 'items.variant', 'items.variant.product'],
    });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    return cart;
  }
}
