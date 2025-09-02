import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategorieDto } from './dto/update-category.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private repo: Repository<Category>,
  ) {}

  create(dto: CreateCategoryDto) {
    const category = plainToInstance(Category, dto);
    return this.repo.save(category);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  update(id: number, dto: UpdateCategorieDto) {
    return this.repo.update(id, dto);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
