import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderItem } from './entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';

@Injectable()
export class OrderItemsService {
  constructor(
    @InjectRepository(OrderItem)
    private readonly repo: Repository<OrderItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  async create(dto: CreateOrderItemDto) {
    await this.ensureOrderExists(dto.orderId);
    await this.ensureVariantExists(dto.variantId);

    const quantity = this.normalizeQuantity(dto.quantity);
    const discountTotal = this.normalizeMoney(dto.discountTotal ?? 0);
    const subTotal = this.normalizeMoney(dto.subTotal);
    const totalAmount = this.resolveTotalAmount(subTotal, discountTotal, dto.totalAmount);

    const entity = this.repo.create({
      orderId: dto.orderId,
      variantId: dto.variantId,
      quantity,
      subTotal,
      discountTotal,
      totalAmount,
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find({
      relations: {
        order: true,
        variant: { product: true },
      },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({
      where: { id },
      relations: {
        order: true,
        variant: { product: true },
      },
    });

    if (!item) {
      throw new NotFoundException(`Order item ${id} not found`);
    }

    return item;
  }

  async update(id: number, dto: UpdateOrderItemDto) {
    const existing = await this.repo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Order item ${id} not found`);
    }

    const nextOrderId = dto.orderId ?? existing.orderId;
    const nextVariantId = dto.variantId ?? existing.variantId ?? undefined;

    await this.ensureOrderExists(nextOrderId);
    await this.ensureVariantExists(nextVariantId);

    const quantity =
      dto.quantity !== undefined ? this.normalizeQuantity(dto.quantity) : existing.quantity;
    const subTotal =
      dto.subTotal !== undefined ? this.normalizeMoney(dto.subTotal) : existing.subTotal;
    const discountTotal =
      dto.discountTotal !== undefined
        ? this.normalizeMoney(dto.discountTotal)
        : existing.discountTotal;

    const totalAmount = this.resolveTotalAmount(
      subTotal,
      discountTotal,
      dto.totalAmount ?? existing.totalAmount,
    );

    const merged = this.repo.merge(existing, {
      orderId: nextOrderId,
      variantId: nextVariantId,
      quantity,
      subTotal,
      discountTotal,
      totalAmount,
    });

    return this.repo.save(merged);
  }

  async remove(id: number) {
    const existing = await this.repo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Order item ${id} not found`);
    }

    await this.repo.remove(existing);

    return { success: true };
  }

  private async ensureOrderExists(orderId: number) {
    const exists = await this.orderRepo.exist({ where: { id: orderId } });

    if (!exists) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }
  }

  private async ensureVariantExists(variantId?: number) {
    if (variantId === undefined) {
      return;
    }

    const exists = await this.variantRepo.exist({ where: { id: variantId } });

    if (!exists) {
      throw new BadRequestException(`Product variant ${variantId} not found`);
    }
  }

  private normalizeQuantity(raw?: number) {
    const value = Math.trunc(raw ?? 1);

    if (value < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    return value;
  }

  private normalizeMoney(raw: number) {
    if (raw < 0) {
      throw new BadRequestException('Amount cannot be negative');
    }

    return Math.round(raw * 100) / 100;
  }

  private resolveTotalAmount(subTotal: number, discountTotal: number, provided?: number) {
    if (provided !== undefined && provided !== null) {
      if (provided < 0) {
        throw new BadRequestException('Total amount cannot be negative');
      }

      return Math.round(provided * 100) / 100;
    }

    return Math.round((subTotal - discountTotal) * 100) / 100;
  }
}
