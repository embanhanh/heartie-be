import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
// import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private repo: Repository<Order>,
  ) {}

  create(dto: CreateOrderDto) {
    return this.repo.save(dto);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  // update(id: number, dto: UpdateOrderDto) {
  //   return this.repo.update(id, dto);
  // }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
