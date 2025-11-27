import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Address, AddressType } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private repo: Repository<Address>,
  ) {}

  async create(dto: CreateAddressDto) {
    const entity = this.repo.create({
      userId: dto.userId ?? null,
      fullName: dto.fullName.trim(),
      phoneNumber: dto.phoneNumber.trim(),
      email: dto.email.trim(),
      street: this.sanitizeNullable(dto.street),
      ward: this.sanitizeNullable(dto.ward),
      district: this.sanitizeNullable(dto.district),
      province: this.sanitizeNullable(dto.province),
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      fullAddress: this.sanitizeNullable(dto.fullAddress),
      addressType: dto.addressType ?? AddressType.HOME,
      isDefault: dto.isDefault ?? false,
    });

    const saved = await this.repo.save(entity);

    if (saved.isDefault && saved.userId) {
      await this.unsetOtherDefaults(saved.userId, saved.id);
    }

    return saved;
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const address = await this.repo.findOne({ where: { id } });

    if (!address) {
      throw new NotFoundException(`Address ${id} not found`);
    }

    return address;
  }

  async update(id: number, dto: UpdateAddressDto) {
    const existing = await this.repo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Address ${id} not found`);
    }

    if (dto.userId !== undefined && dto.userId === null) {
      throw new BadRequestException('userId must be a positive number or omitted');
    }

    const updates: Partial<Address> = {};

    if (dto.userId !== undefined) {
      updates.userId = dto.userId ?? null;
    }

    if (dto.fullName !== undefined) {
      updates.fullName = dto.fullName.trim();
    }

    if (dto.phoneNumber !== undefined) {
      updates.phoneNumber = dto.phoneNumber.trim();
    }

    if (dto.email !== undefined) {
      updates.email = dto.email.trim();
    }

    if (dto.street !== undefined) {
      updates.street = this.sanitizeNullable(dto.street) ?? null;
    }

    if (dto.ward !== undefined) {
      updates.ward = this.sanitizeNullable(dto.ward) ?? null;
    }

    if (dto.district !== undefined) {
      updates.district = this.sanitizeNullable(dto.district) ?? null;
    }

    if (dto.province !== undefined) {
      updates.province = dto.province.trim();
    }

    if (dto.lat !== undefined) {
      updates.lat = dto.lat ?? null;
    }

    if (dto.lng !== undefined) {
      updates.lng = dto.lng ?? null;
    }

    if (dto.fullAddress !== undefined) {
      updates.fullAddress = this.sanitizeNullable(dto.fullAddress) ?? null;
    }

    if (dto.addressType !== undefined) {
      updates.addressType = dto.addressType;
    }

    if (dto.isDefault !== undefined) {
      updates.isDefault = dto.isDefault;
    }

    const merged = this.repo.merge(existing, updates);

    const saved = await this.repo.save(merged);

    if (saved.isDefault && saved.userId) {
      await this.unsetOtherDefaults(saved.userId, saved.id);
    }

    return saved;
  }

  async remove(id: number) {
    const existing = await this.repo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Address ${id} not found`);
    }

    await this.repo.remove(existing);

    return { success: true };
  }

  private async unsetOtherDefaults(userId: number, keepId: number) {
    await this.repo.update({ userId, id: Not(keepId) }, { isDefault: false });
  }

  private sanitizeNullable(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
