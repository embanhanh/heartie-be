import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductVariantsModule } from './modules/product_variants/product_variants.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { StoresModule } from './modules/stores/stores.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { BannersModule } from './modules/banners/banners.module';
import { StoreInventoriesModule } from './modules/store_inventories/store_inventories.module';
import { VoucherUserDetailsModule } from './modules/voucher_user_details/voucher_user_details.module';
import { OrderProductDetailsModule } from './modules/order_product_details/order_product_details.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PromotionalComboDetailsModule } from './modules/promotional_combo_details/promotional_combo_details.module';
import { PromotionalCombosModule } from './modules/promotional_combos/promotional_combos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT') || '5432'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: true, // Chỉ dùng trong development, tự động tạo table.
      }),
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    ProductVariantsModule,
    RatingsModule,
    StoresModule,
    CategoriesModule,
    VouchersModule,
    InteractionsModule,
    BannersModule,
    StoreInventoriesModule,
    VoucherUserDetailsModule,
    OrderProductDetailsModule,
    AddressesModule,
    OrdersModule,
    PromotionalComboDetailsModule,
    PromotionalCombosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
