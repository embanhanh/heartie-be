import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Voucher } from './entities/voucher.entity';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { Product } from 'src/modules/products/entities/product.entity';
import { VoucherUserDetail } from 'src/modules/voucher_user_details/entities/voucher_user_detail.entity';

@Injectable()
export class VouchersService {
  constructor(
    @InjectRepository(Voucher)
    private voucherRepo: Repository<Voucher>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(VoucherUserDetail)
    private voucherUserDetailRepo: Repository<VoucherUserDetail>,
  ) {}

  async create(dto: CreateVoucherDto) {
    const { applicableProducts: productIds, ...rest } = dto;

    // loại bỏ id trùng lặp
    const uniqueIds = Array.from(new Set(productIds ?? []));
    // nạp Product[] theo ids
    const applicableProducts = uniqueIds.length
      ? await this.productRepo.findBy({ id: In(uniqueIds) })
      : [];

    //báo lỗi nếu có id không tồn tại (optionally)
    if (uniqueIds.length !== applicableProducts.length) {
      const found = new Set(applicableProducts.map((p) => p.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new Error(`Product not found: [${missing.join(', ')}]`);
    }
    const product = this.voucherRepo.create({
      ...rest,
      applicableProducts,
    });
    return this.voucherRepo.save(product);
  }

  findAll() {
    return this.voucherRepo.find();
  }

  findOne(id: number) {
    return this.voucherRepo.findOneBy({ id });
  }

  findByCode(code: string) {
    return this.voucherRepo.findOne({ where: { code } });
  }

  // update(id: number, dto: UpdateVoucherDto) {
  //   return this.repo.update(id, dto);
  // }

  remove(id: number) {
    return this.voucherRepo.delete(id);
  }

  /**
   * Get available vouchers for a user
   * - Public vouchers that are still valid and have usage left
   * - Private vouchers assigned to the user that haven't been used
   */
  async findAvailableForUser(userId: number): Promise<any[]> {
    const now = new Date();

    // 1. Get public vouchers that are valid and visible
    const publicVouchers = await this.voucherRepo.find({
      where: {
        voucherType: 'public',
        visplay: true,
        validFrom: LessThanOrEqual(now),
        validUntil: MoreThanOrEqual(now),
      },
    });

    // Filter by usage limit
    const availablePublic = publicVouchers.filter((v) => v.used < v.usageLimit);

    // 2. Get private vouchers assigned to this user
    const userVoucherDetails = await this.voucherUserDetailRepo.find({
      where: {
        idUser: userId,
        used: false,
        validFrom: LessThanOrEqual(now),
        validUntil: MoreThanOrEqual(now),
      },
      relations: ['voucher'],
    });

    const privateVouchers = userVoucherDetails
      .map((detail) => detail.voucher)
      .filter((v) => v && v.used < v.usageLimit);

    // Combine and deduplicate
    const allVouchers = [...availablePublic];
    for (const pv of privateVouchers) {
      if (!allVouchers.find((v) => v.id === pv.id)) {
        allVouchers.push(pv);
      }
    }

    // Format for frontend display
    return allVouchers.map((v) => ({
      id: v.id,
      code: v.code,
      discountType: v.discountType,
      discountValue: Number(v.discountValue),
      minOrderValue: Number(v.minOrderValue),
      maxDiscountValue: v.maxDiscountValue ? Number(v.maxDiscountValue) : null,
      validUntil: v.validUntil,
      description: this.formatVoucherDescription(v),
    }));
  }

  /**
   * Validate a voucher code for a user and order total
   */
  async validateVoucher(
    code: string,
    userId: number,
    orderTotal: number,
  ): Promise<{ valid: boolean; voucher?: any; error?: string; discountAmount?: number }> {
    const voucher = await this.voucherRepo.findOne({ where: { code } });

    if (!voucher) {
      return { valid: false, error: 'Mã voucher không tồn tại.' };
    }

    const now = new Date();

    // Check validity dates
    if (now < voucher.validFrom || now > voucher.validUntil) {
      return { valid: false, error: 'Voucher đã hết hạn hoặc chưa có hiệu lực.' };
    }

    // Check usage limit
    if (voucher.used >= voucher.usageLimit) {
      return { valid: false, error: 'Voucher đã hết lượt sử dụng.' };
    }

    // Check min order value
    if (orderTotal < Number(voucher.minOrderValue)) {
      return {
        valid: false,
        error: `Đơn hàng tối thiểu ${Number(voucher.minOrderValue).toLocaleString('vi-VN')}₫ để áp dụng voucher này.`,
      };
    }

    // For private vouchers, check if assigned to user
    if (voucher.voucherType === 'private') {
      const userDetail = await this.voucherUserDetailRepo.findOne({
        where: { idVoucher: voucher.id, idUser: userId, used: false },
      });

      if (!userDetail) {
        return { valid: false, error: 'Bạn không có quyền sử dụng voucher này.' };
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (voucher.discountType === 'percentage') {
      discountAmount = (orderTotal * Number(voucher.discountValue)) / 100;
      if (voucher.maxDiscountValue && discountAmount > Number(voucher.maxDiscountValue)) {
        discountAmount = Number(voucher.maxDiscountValue);
      }
    } else {
      discountAmount = Number(voucher.discountValue);
    }

    return {
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        discountType: voucher.discountType,
        discountValue: Number(voucher.discountValue),
        description: this.formatVoucherDescription(voucher),
      },
      discountAmount,
    };
  }

  private formatVoucherDescription(v: Voucher): string {
    if (v.discountType === 'percentage') {
      const maxDiscount = v.maxDiscountValue
        ? ` (tối đa ${Number(v.maxDiscountValue).toLocaleString('vi-VN')}₫)`
        : '';
      return `Giảm ${v.discountValue}%${maxDiscount}`;
    } else {
      return `Giảm ${Number(v.discountValue).toLocaleString('vi-VN')}₫`;
    }
  }
}
