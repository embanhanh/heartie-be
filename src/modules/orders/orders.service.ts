import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { FulfillmentMethod, Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { User } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { Address } from '../addresses/entities/address.entity';
import { AddressesService } from '../addresses/addresses.service';
import { CreateAddressDto } from '../addresses/dto/create-address.dto';
import { PricingService, PricingSummary } from '../pricing/pricing.service';

@Injectable()
export class OrdersService {
  private readonly orderRelations: FindOptionsRelations<Order> = {
    user: true,
    branch: true,
    address: true,
    items: {
      variant: {
        product: true,
      },
    },
  };

  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    private readonly addressesService: AddressesService,
    private readonly pricingService: PricingService,
  ) {}

  async create(dto: CreateOrderDto) {
    const resolvedAddressId = await this.resolveAddressId({
      providedAddressId: dto.addressId,
      addressPayload: dto.address,
      userId: dto.userId,
    });

    const effectiveAddressId = resolvedAddressId ?? undefined;

    await this.validateRelations({
      userId: dto.userId,
      branchId: dto.branchId,
      addressId: effectiveAddressId,
    });

    const pricing = await this.pricingService.calculate({
      items: dto.items,
      promotionId: dto.promotionId,
      branchId: dto.branchId,
      addressId: effectiveAddressId,
      userId: dto.userId,
    });

    const entity = this.repo.create({
      userId: dto.userId ?? null,
      branchId: dto.branchId ?? null,
      addressId: resolvedAddressId ?? null,
      note: dto.note,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.COD,
      fulfillmentMethod: dto.fulfillmentMethod ?? FulfillmentMethod.DELIVERY,
      expectedDeliveryDate: dto.expectedDeliveryDate,
      paidAt: dto.paidAt,
      deliveredAt: dto.deliveredAt,
      cancelledAt: dto.cancelledAt,
      status: dto.status ?? OrderStatus.PENDING,
      orderNumber: this.generateOrderNumber(),
      subTotal: pricing.totals.subTotal,
      discountTotal: pricing.totals.discountTotal,
      shippingFee: pricing.totals.shippingFee,
      taxTotal: pricing.totals.taxTotal,
      totalAmount: pricing.totals.totalAmount,
    });

    const savedOrder = await this.repo.save(entity);

    await this.saveOrderItems(savedOrder.id, pricing);

    return this.findOne(savedOrder.id);
  }

  findAll() {
    return this.repo.find({
      relations: this.orderRelations,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const order = await this.repo.findOne({
      where: { id },
      relations: this.orderRelations,
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  async update(id: number, dto: UpdateOrderDto) {
    const existing = await this.repo.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!existing) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const { items, promotionId, address, ...rest } = dto;

    const targetUserId = rest.userId ?? existing.userId ?? undefined;
    const targetBranchId = rest.branchId ?? existing.branchId ?? undefined;
    const resolvedAddressId = await this.resolveAddressId({
      providedAddressId: rest.addressId,
      addressPayload: address,
      userId: targetUserId,
    });

    const effectiveAddressId = resolvedAddressId ?? existing.addressId ?? undefined;

    await this.validateRelations({
      userId: targetUserId,
      branchId: targetBranchId,
      addressId: effectiveAddressId,
    });

    let pricing: PricingSummary | null = null;

    if (items && items.length > 0) {
      pricing = await this.pricingService.calculate({
        items,
        promotionId,
        branchId: targetBranchId,
        addressId: effectiveAddressId,
        userId: targetUserId,
      });
    }

    const merged = this.repo.merge(existing, rest);

    merged.addressId = resolvedAddressId ?? existing.addressId ?? null;

    merged.status = merged.status ?? OrderStatus.PENDING;
    merged.paymentMethod = merged.paymentMethod ?? PaymentMethod.COD;

    if (pricing) {
      merged.subTotal = pricing.totals.subTotal;
      merged.discountTotal = pricing.totals.discountTotal;
      merged.shippingFee = pricing.totals.shippingFee;
      merged.taxTotal = pricing.totals.taxTotal;
      merged.totalAmount = pricing.totals.totalAmount;
    }

    const saved = await this.repo.save(merged);

    if (pricing) {
      await this.orderItemRepo.delete({ orderId: saved.id });
      await this.saveOrderItems(saved.id, pricing);
    }

    return this.findOne(saved.id);
  }

  async remove(id: number) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    await this.repo.delete(id);
    return { success: true };
  }

  private async saveOrderItems(orderId: number, pricing: PricingSummary) {
    if (pricing.items.length === 0) {
      return;
    }

    const items = pricing.items.map((item) =>
      this.orderItemRepo.create({
        orderId,
        variantId: item.variantId,
        quantity: item.quantity,
        subTotal: item.subTotal,
        discountTotal: item.discountTotal,
        totalAmount: item.totalAmount,
      }),
    );

    await this.orderItemRepo.save(items);
  }

  private async validateRelations(payload: {
    userId?: number;
    branchId?: number;
    addressId?: number;
  }) {
    const { userId, branchId, addressId } = payload;

    if (userId !== undefined) {
      const exists = await this.userRepo.exist({ where: { id: userId } });

      if (!exists) {
        throw new BadRequestException(`User ${userId} not found`);
      }
    }

    if (branchId !== undefined) {
      const exists = await this.branchRepo.exist({ where: { id: branchId } });

      if (!exists) {
        throw new BadRequestException(`Branch ${branchId} not found`);
      }
    }

    if (addressId !== undefined && addressId !== null) {
      const exists = await this.addressRepo.exist({ where: { id: addressId } });

      if (!exists) {
        throw new BadRequestException(`Address ${addressId} not found`);
      }
    }
  }

  private async resolveAddressId(params: {
    providedAddressId?: number;
    addressPayload?: CreateAddressDto;
    userId?: number;
  }): Promise<number | null> {
    if (params.providedAddressId) {
      return params.providedAddressId;
    }

    if (!params.addressPayload) {
      return null;
    }

    const payload: CreateAddressDto = {
      ...params.addressPayload,
      userId: params.addressPayload.userId ?? params.userId,
    };

    const created = await this.addressesService.create(payload);

    return created.id;
  }

  private generateOrderNumber() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    return `ORD-${stamp}-${random}`;
  }
}
