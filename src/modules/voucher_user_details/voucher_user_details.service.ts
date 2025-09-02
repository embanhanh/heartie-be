import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoucherUserDetail } from './entities/voucher_user_detail.entity';
import { CreateVoucherUserDetailDto } from './dto/create-voucher_user_detail.dto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { User } from 'src/modules/users/entities/user.entity';
import { Voucher } from 'src/modules/vouchers/entities/voucher.entity';

@Injectable()
export class VoucherUserDetailsService {
  constructor(
    @InjectRepository(VoucherUserDetail)
    private repo: Repository<VoucherUserDetail>,

    @InjectRepository(Voucher)
    private voucherRepo: Repository<Voucher>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createDto: CreateVoucherUserDetailDto): Promise<VoucherUserDetail> {
    // Validate Voucher tồn tại
    const voucher = await this.voucherRepo.findOne({
      where: { id: createDto.idVoucher },
    });

    if (!voucher) {
      throw new BadRequestException(`Voucher with ID ${createDto.idVoucher} does not exist`);
    }

    // Validate User tồn tại
    const user = await this.userRepository.findOne({
      where: { id: createDto.idUser },
    });

    if (!user) {
      throw new BadRequestException(`User with ID ${createDto.idUser} does not exist`);
    }

    // Kiểm tra duplicate
    const existing = await this.repo.findOne({
      where: {
        idVoucher: createDto.idVoucher,
        idUser: createDto.idUser,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Voucher ${createDto.idVoucher} already assigned to user ${createDto.idUser}`,
      );
    }

    // Validate dates
    const validFrom = new Date(createDto.validFrom);
    const validUntil = new Date(createDto.validUntil);

    if (validFrom >= validUntil) {
      throw new BadRequestException('validFrom must be before validUntil');
    }

    if (validUntil < new Date()) {
      throw new BadRequestException('validUntil cannot be in the past');
    }

    // Tạo entity
    const voucherUserDetail = this.repo.create({
      idVoucher: createDto.idVoucher,
      idUser: createDto.idUser,
      validFrom: validFrom,
      validUntil: validUntil,
      used: createDto.used || false,
      usedAt: createDto.usedAt,
    });

    return await this.repo.save(voucherUserDetail);
  }

  findAll() {
    return this.repo.find();
  }

  // findOne(id: number) {
  //   return this.repo.findOneBy({ id });
  // }

  // update(id: number, dto: UpdateVoucherUserDetailDto) {
  //   return this.repo.update(id, dto);
  // }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
