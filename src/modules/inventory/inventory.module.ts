import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductVariantInventory } from './entities/product-variant-inventory.entity';
import { InventoryLog } from './entities/inventory-log.entity';
import { StockTransfer } from './entities/stock-transfer.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { Branch } from '../branches/entities/branch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductVariantInventory,
      InventoryLog,
      StockTransfer,
      ProductVariant,
      User,
      Branch,
    ]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
