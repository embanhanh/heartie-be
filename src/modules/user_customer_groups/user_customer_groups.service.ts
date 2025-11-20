import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import { UserCustomerGroup } from './entities/user-customer-group.entity';
import { CreateUserCustomerGroupDto } from './dto/create-user-customer-group.dto';
import { UpdateUserCustomerGroupDto } from './dto/update-user-customer-group.dto';
import { FilterUserCustomerGroupDto } from './dto/filter-user-customer-group.dto';
import { User } from '../users/entities/user.entity';
import { CustomerGroup } from '../customer_groups/entities/customer-group.entity';

@Injectable()
export class UserCustomerGroupsService {
  private readonly defaultRelations = {
    user: true,
    customerGroup: true,
  } as const;

  constructor(
    @InjectRepository(UserCustomerGroup)
    private readonly repo: Repository<UserCustomerGroup>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CustomerGroup)
    private readonly customerGroupRepo: Repository<CustomerGroup>,
  ) {}

  async create(dto: CreateUserCustomerGroupDto) {
    await this.ensureUserExists(dto.userId);
    await this.ensureCustomerGroupExists(dto.customerGroupId);

    const exists = await this.repo.exist({
      where: { userId: dto.userId, customerGroupId: dto.customerGroupId },
    });

    if (exists) {
      throw new ConflictException('User is already assigned to the customer group');
    }

    const entity = this.repo.create({
      userId: dto.userId,
      customerGroupId: dto.customerGroupId,
    });

    await this.repo.save(entity);

    return this.findOne(dto.userId, dto.customerGroupId);
  }

  async findAll(filter?: FilterUserCustomerGroupDto) {
    const where: FindOptionsWhere<UserCustomerGroup> = {};

    if (filter?.userId !== undefined) {
      where.userId = filter.userId;
    }

    if (filter?.customerGroupId !== undefined) {
      where.customerGroupId = filter.customerGroupId;
    }

    const options: FindManyOptions<UserCustomerGroup> = {
      where: Object.keys(where).length ? where : undefined,
      relations: this.defaultRelations,
      order: { assignedAt: 'DESC' },
    };

    return this.repo.find(options);
  }

  async findOne(userId: number, customerGroupId: number) {
    const entity = await this.repo.findOne({
      where: { userId, customerGroupId },
      relations: this.defaultRelations,
    });

    if (!entity) {
      throw new NotFoundException(
        `User customer group not found for user ${userId} and group ${customerGroupId}`,
      );
    }

    return entity;
  }

  async update(userId: number, customerGroupId: number, dto: UpdateUserCustomerGroupDto) {
    const existing = await this.repo.findOne({ where: { userId, customerGroupId } });

    if (!existing) {
      throw new NotFoundException(
        `User customer group not found for user ${userId} and group ${customerGroupId}`,
      );
    }

    const nextUserId = dto.userId ?? userId;
    const nextCustomerGroupId = dto.customerGroupId ?? customerGroupId;

    if (nextUserId === userId && nextCustomerGroupId === customerGroupId) {
      return this.findOne(userId, customerGroupId);
    }

    await this.ensureUserExists(nextUserId);
    await this.ensureCustomerGroupExists(nextCustomerGroupId);

    const duplicate = await this.repo.findOne({
      where: { userId: nextUserId, customerGroupId: nextCustomerGroupId },
    });

    if (duplicate) {
      throw new ConflictException('User is already assigned to the target customer group');
    }

    await this.repo.manager.transaction(async (manager) => {
      await manager.delete(UserCustomerGroup, { userId, customerGroupId });

      const replacement = manager.create(UserCustomerGroup, {
        userId: nextUserId,
        customerGroupId: nextCustomerGroupId,
      });

      await manager.save(UserCustomerGroup, replacement);
    });

    return this.findOne(nextUserId, nextCustomerGroupId);
  }

  async remove(userId: number, customerGroupId: number) {
    const entity = await this.repo.findOne({ where: { userId, customerGroupId } });

    if (!entity) {
      throw new NotFoundException(
        `User customer group not found for user ${userId} and group ${customerGroupId}`,
      );
    }

    await this.repo.remove(entity);

    return { userId, customerGroupId };
  }

  private async ensureUserExists(userId: number) {
    const exists = await this.userRepo.exist({ where: { id: userId } });

    if (!exists) {
      throw new NotFoundException(`User not found: ${userId}`);
    }
  }

  private async ensureCustomerGroupExists(customerGroupId: number) {
    const exists = await this.customerGroupRepo.exist({ where: { id: customerGroupId } });

    if (!exists) {
      throw new NotFoundException(`Customer group not found: ${customerGroupId}`);
    }
  }
}
