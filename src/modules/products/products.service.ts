import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  // Nếu bạn CHƯA dùng ValueTransformer cho decimal, có thể chuẩn hóa số thập phân:
  private toFixed2(n: number) {
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  }
  private toFixed1(n: number) {
    return Number.isFinite(n) ? Number(n.toFixed(1)) : 0;
  }

  async create(dto: CreateProductDto) {
    // tách category ids ra khỏi dto
    const { categories: categoryIds, ...rest } = dto;

    // loại bỏ id trùng lặp
    const uniqueIds = Array.from(new Set(categoryIds ?? []));

    // nạp Category[] theo ids
    const categories = uniqueIds.length
      ? await this.categoryRepo.findBy({ id: In(uniqueIds) })
      : [];

    // báo lỗi nếu có id không tồn tại (optionally)
    if (uniqueIds.length !== categories.length) {
      const found = new Set(categories.map((c) => c.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Category not found: [${missing.join(', ')}]`);
    }

    // tạo entity Product
    const product = this.productRepo.create({
      ...rest,
      categories, // gán Category[] để TypeORM tạo product_categories tự động
    });

    return this.productRepo.save(product);
  }

  findAll() {
    return this.productRepo.find();
  }

  findOne(id: number) {
    return this.productRepo.findOneBy({ id });
  }

  update(id: number, dto: UpdateProductDto) {
    return this.productRepo.update(id, dto);
  }

  remove(id: number) {
    return this.productRepo.delete(id);
  }
}
