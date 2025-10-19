import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { User } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  async create(dto: CreateOrderDto) {
    await this.validateRelations(dto);

    const {
      orderNumber,
      status,
      paymentMethod,
      subTotal,
      discountTotal,
      shippingFee,
      taxTotal,
      totalAmount,
      ...rest
    } = dto;

    const normalizedSubTotal = subTotal ?? 0;
    const normalizedDiscount = discountTotal ?? 0;
    const normalizedShipping = shippingFee ?? 0;
    const normalizedTax = taxTotal ?? 0;

    const entity = this.repo.create({
      ...rest,
      orderNumber: orderNumber ?? this.generateOrderNumber(),
      status: status ?? OrderStatus.PENDING,
      paymentMethod: paymentMethod ?? PaymentMethod.CASH,
      subTotal: normalizedSubTotal,
      discountTotal: normalizedDiscount,
      shippingFee: normalizedShipping,
      taxTotal: normalizedTax,
      totalAmount:
        totalAmount ??
        this.calculateTotalAmount(
          normalizedSubTotal,
          normalizedDiscount,
          normalizedShipping,
          normalizedTax,
        ),
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find({ relations: { user: true, branch: true } });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id }, relations: { user: true, branch: true } });
  }

  async update(id: number, dto: UpdateOrderDto) {
    const order = await this.repo.findOneBy({ id });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    await this.validateRelations(dto);

    const merged = this.repo.merge(order, dto);

    merged.orderNumber = merged.orderNumber ?? this.generateOrderNumber();
    merged.status = merged.status ?? OrderStatus.PENDING;
    merged.paymentMethod = merged.paymentMethod ?? PaymentMethod.CASH;

    if (dto.totalAmount === undefined) {
      merged.totalAmount = this.calculateTotalAmount(
        merged.subTotal ?? 0,
        merged.discountTotal ?? 0,
        merged.shippingFee ?? 0,
        merged.taxTotal ?? 0,
      );
    }

    return this.repo.save(merged);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  private async validateRelations(payload: { userId?: number; branchId?: number }) {
    const { userId, branchId } = payload;

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
  }

  private calculateTotalAmount(
    subTotal: number,
    discountTotal: number,
    shippingFee: number,
    taxTotal: number,
  ) {
    return subTotal - discountTotal + shippingFee + taxTotal;
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
