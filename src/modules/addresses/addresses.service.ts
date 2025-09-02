import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/addresse.entity';
import { CreateAddressDto } from './dto/create-addresse.dto';
import { UpdateAddresseDto } from './dto/update-addresse.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private repo: Repository<Address>,
  ) {}

  create(dto: CreateAddressDto) {
    return this.repo.save(dto);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  update(id: number, dto: UpdateAddresseDto) {
    return this.repo.update(id, dto);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
