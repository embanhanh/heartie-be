import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreInventory } from './entities/store_inventorie.entity';
import { CreateStoreInventoryDto } from './dto/create-store_inventorie.dto';
// import { UpdateStoreInventorieDto } from './dto/update-store_inventorie.dto';
import { Store } from 'src/modules/stores/entities/store.entity';
import { ProductVariant } from 'src/modules/product_variants/entities/product_variant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { BadRequestException, ConflictException } from '@nestjs/common';

@Injectable()
export class StoreInventoriesService {
  constructor(
    @InjectRepository(StoreInventory)
    private storeInventoryRepo: Repository<StoreInventory>,

    @InjectRepository(Store)
    private storeRepo: Repository<Store>,

    @InjectRepository(ProductVariant)
    private productVariantRepo: Repository<ProductVariant>,

    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(createDto: CreateStoreInventoryDto): Promise<StoreInventory> {
    // Validate Store exists
    const store = await this.storeRepo.findOne({
      where: { id: createDto.idStore },
    });

    if (!store) {
      throw new BadRequestException(`Store with ID ${createDto.idStore} does not exist`);
    }

    // Validate ProductVariant exists
    const productVariant = await this.productVariantRepo.findOne({
      where: { id: createDto.idProductVariant },
    });

    if (!productVariant) {
      throw new BadRequestException(
        `Product variant with ID ${createDto.idProductVariant} does not exist`,
      );
    }

    // Validate User exists (if provided)
    if (createDto.updatedBy) {
      const user = await this.userRepo.findOne({
        where: { id: createDto.updatedBy },
      });

      if (!user) {
        throw new BadRequestException(`User with ID ${createDto.updatedBy} does not exist`);
      }
    }

    // Check duplicate
    const existing = await this.storeInventoryRepo.findOne({
      where: {
        idStore: createDto.idStore,
        idProductVariant: createDto.idProductVariant,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Inventory for store ${createDto.idStore} and product variant ${createDto.idProductVariant} already exists`,
      );
    }

    // Validate business logic
    if (createDto.reserved && createDto.reserved > createDto.stockOnHand) {
      throw new BadRequestException('Reserved quantity cannot exceed stock on hand');
    }

    if (createDto.price <= 0) {
      throw new BadRequestException('Price must be greater than 0');
    }

    // Create inventory
    const inventory = this.storeInventoryRepo.create({
      idStore: createDto.idStore,
      idProductVariant: createDto.idProductVariant,
      stockOnHand: createDto.stockOnHand,
      reserved: createDto.reserved || 0,
      price: createDto.price,
      status: createDto.status || 'ACTIVE',
      updatedBy: createDto.updatedBy,
      updatedAt: new Date(),
    });

    return await this.storeInventoryRepo.save(inventory);
  }

  // findAll() {
  //   return this.repo.find();
  // }

  // findOne(id: number) {
  //   return this.repo.findOneBy({ id });
  // }

  // update(id: number, dto: UpdateStoreInventorieDto) {
  //   return this.repo.update(id, dto);
  // }

  // remove(id: number) {
  //   return this.repo.delete(id);
  // }
}
