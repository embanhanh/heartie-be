import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderProductDetail } from './entities/order_product_detail.entity';
import { CreateOrderProductDetailDto } from './dto/create-order_product_detail.dto';
// import { UpdateOrderProductDetailDto } from './dto/update-order_product_detail.dto';

@Injectable()
export class OrderProductDetailsService {
  constructor(
    @InjectRepository(OrderProductDetail)
    private repo: Repository<OrderProductDetail>,
  ) {}

  create(dto: CreateOrderProductDetailDto) {
    return this.repo.save(dto);
  }

  findAll() {
    return this.repo.find();
  }

  // findOne(id: number) {
  //   return this.repo.findOneBy({ id });
  // }

  // update(id: number, dto: UpdateOrderProductDetailDto) {
  //   return this.repo.update(id, dto);
  // }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
