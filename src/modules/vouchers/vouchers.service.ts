import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Voucher } from './entities/voucher.entity';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { Product } from 'src/modules/products/entities/product.entity';

@Injectable()
export class VouchersService {
  constructor(
    @InjectRepository(Voucher)
    private voucherRepo: Repository<Voucher>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
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

  // update(id: number, dto: UpdateVoucherDto) {
  //   return this.repo.update(id, dto);
  // }

  remove(id: number) {
    return this.voucherRepo.delete(id);
  }
}
