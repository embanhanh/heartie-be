import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserSafe } from './types/user-safe.type';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

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
      this.usersRepository.findOne({ where: { email: createUserDto.email } }),
      this.usersRepository.findOne({ where: { phoneNumber: createUserDto.phoneNumber } }),
    ]);

    if (existingUserByEmail) {
      throw new ConflictException('Email đã tồn tại');
    }

    if (existingUserByPhone) {
      throw new ConflictException('Số điện thoại đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const newUser = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(newUser);
    const safeUser = this.sanitizeUser(savedUser);
    if (!safeUser) {
      throw new Error('Không thể khởi tạo người dùng mới');
    }
    return safeUser;
  }

  async findOneByEmail(email: string): Promise<UserSafe | null> {
    const user = await this.usersRepository.findOne({ where: { email } });
    return this.sanitizeUser(user);
  }

  async findOneByEmailWithSecrets(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect(['user.password', 'user.hashedRefreshToken'])
      .where('user.email = :email', { email })
      .getOne();
  }

  async findOneById(id: number): Promise<UserSafe | null> {
    const user = await this.usersRepository.findOne({ where: { id } });
    return this.sanitizeUser(user);
  }

  async findOneByIdWithRefreshToken(id: number): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.hashedRefreshToken')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setCurrentRefreshToken(refreshToken: string, userId: number): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersRepository.update(userId, {
      hashedRefreshToken,
    });
  }

  async removeRefreshToken(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      hashedRefreshToken: null,
    });
  }
}
