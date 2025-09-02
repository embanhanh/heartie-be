import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionalComboDetail } from './entities/promotional_combo_detail.entity';
import { CreatePromotionalComboDetailDto } from './dto/create-promotional_combo_detail.dto';
// import { UpdatePromotionalComboDetailDto } from './dto/update-promotional_combo_detail.dto';

@Injectable()
export class PromotionalComboDetailsService {
  constructor(
    @InjectRepository(PromotionalComboDetail)
    private repo: Repository<PromotionalComboDetail>,
  ) {}

  create(dto: CreatePromotionalComboDetailDto) {
    return this.repo.save(dto);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  // update(id: number, dto: UpdatePromotionalComboDetailDto) {
  //   return this.repo.update(id, dto);
  // }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
