import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { InteractionsService } from '../interactions/interactions.service';
import { InteractionType } from '../interactions/entities/interaction.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';

@Injectable()
export class CartItemsService {
  constructor(
    @InjectRepository(Cart) private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private readonly itemRepo: Repository<CartItem>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepo: Repository<ProductVariant>,
    private readonly interactionsService: InteractionsService,
  ) {}

  private async getOrCreateCart(userId: number): Promise<Cart> {
    let cart = await this.cartRepo.findOne({ where: { userId } });
    if (!cart) {
      cart = this.cartRepo.create({ userId });
      cart = await this.cartRepo.save(cart);
    }
    return cart;
  }

  async addItem(userId: number, dto: AddCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const quantity = Math.max(1, dto.quantity ?? 1);

    // Track ADD_TO_CART interaction
    if (userId) {
      const variant = await this.productVariantRepo.findOne({
        where: { id: dto.variantId },
        relations: ['product'],
      });
      if (variant?.product?.tikiId) {
        this.interactionsService.logInteraction(
          userId,
          +variant.product.tikiId,
          InteractionType.ADD_TO_CART,
        );
      }
    }

    let item = await this.itemRepo.findOne({
      where: { cartId: cart.id, variantId: dto.variantId },
    });
    if (item) {
      item.quantity += quantity;
    } else {
      item = this.itemRepo.create({ cartId: cart.id, variantId: dto.variantId, quantity });
    }
    const createdItem = await this.itemRepo.save(item);
    return createdItem;
  }

  async updateItem(userId: number, itemId: number, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.itemRepo.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');
    item.quantity = Math.max(1, dto.quantity);
    const updatedItem = await this.itemRepo.save(item);
    return updatedItem;
  }

  async removeItem(userId: number, itemId: number) {
    const cart = await this.getOrCreateCart(userId);
    const existing = await this.itemRepo.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!existing) throw new NotFoundException('Cart item not found');
    const removedItem = await this.itemRepo.remove(existing);
    return removedItem;
  }

  async clear(userId: number) {
    const cart = await this.getOrCreateCart(userId);
    await this.itemRepo.delete({ cartId: cart.id });
    const [cartOnly, cartItems] = await Promise.all([
      this.cartRepo.findOne({ where: { id: cart.id } }),
      this.itemRepo.find({ where: { cartId: cart.id } }),
    ]);
    return { cart: cartOnly, cart_items: cartItems };
  }
}
