import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreInventoriesService } from './store_inventories.service';
import { StoreInventoriesController } from './store_inventories.controller';
import { StoreInventory } from './entities/store_inventorie.entity';
import { Store } from 'src/modules/stores/entities/store.entity';
import { ProductVariant } from 'src/modules/product_variants/entities/product_variant.entity';
import { User } from 'src/modules/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StoreInventory, Store, ProductVariant, User])],
  controllers: [StoreInventoriesController],
  providers: [StoreInventoriesService],
})
export class StoreInventoriesModule {}
