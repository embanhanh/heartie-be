import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PromotionalCombo } from './entities/promotional_combo.entity';
import { CreatePromotionalComboDto } from './dto/create-promotional_combo.dto';
// import { UpdatePromotionalComboDto } from './dto/update-promotional_combo.dto';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class PromotionalCombosService {
  constructor(
    @InjectRepository(PromotionalCombo)
    private repo: Repository<PromotionalCombo>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
  ) {}

  async create(dto: CreatePromotionalComboDto) {
    const { products: productIds, ...rest } = dto;

    const uniqueIds = Array.from(new Set(productIds ?? []));

    const products = uniqueIds.length ? await this.productRepo.findBy({ id: In(uniqueIds) }) : [];

    if (uniqueIds.length !== products.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new Error(`Product not found: [${missing.join(', ')}]`);
    }

    const product = this.repo.create({
      ...rest,
      products,
    });
    return this.repo.save(product);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  // update(id: number, dto: UpdatePromotionalComboDto) {
  //   return this.repo.update(id, dto);
  // }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
