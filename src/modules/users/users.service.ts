import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserSafe } from './types/user-safe.type';
import { BaseService } from '../../common/services/base.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super(userRepository, 'user');
  }

  private sanitizeUser(user: User | null): UserSafe | null {
    if (!user) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, hashedRefreshToken, ...safeUser } = user;
    return safeUser;
  }

  async create(createUserDto: CreateUserDto): Promise<UserSafe> {
    const [existingUserByEmail, existingUserByPhone] = await Promise.all([
      this.userRepository.findOne({ where: { email: createUserDto.email } }),
      this.userRepository.findOne({ where: { phoneNumber: createUserDto.phoneNumber } }),
    ]);

    if (existingUserByEmail) {
      throw new ConflictException('Email đã tồn tại');
    }

    if (existingUserByPhone) {
      throw new ConflictException('Số điện thoại đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    if (createUserDto.role === UserRole.BRANCH_MANAGER || createUserDto.role === UserRole.STAFF) {
      if (!createUserDto.branchId) {
        throw new BadRequestException(
          'Branch assignment is required for staff and branch managers',
        );
      }
    }

    const newUser = this.userRepository.create({
      ...createUserDto,
      role: createUserDto.role ?? UserRole.CUSTOMER,
      branchId: createUserDto.branchId ?? null,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(newUser);
    const safeUser = this.sanitizeUser(savedUser);
    if (!safeUser) {
      throw new Error('Không thể khởi tạo người dùng mới');
    }
    return safeUser;
  }

  async findOneByEmail(email: string): Promise<UserSafe | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    return this.sanitizeUser(user);
  }

  async findOneByEmailWithSecrets(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.password', 'user.hashedRefreshToken'])
      .where('user.email = :email', { email })
      .getOne();
  }

  async findOneById(id: number): Promise<UserSafe | null> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { participants: true },
    });
    return this.sanitizeUser(user);
  }

  async findOneByIdWithRefreshToken(id: number): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.hashedRefreshToken')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setCurrentRefreshToken(refreshToken: string, userId: number): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, {
      hashedRefreshToken,
    });
  }

  async removeRefreshToken(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      hashedRefreshToken: null,
    });
  }
}
