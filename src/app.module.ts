import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { BannersModule } from './modules/banners/banners.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { AttributeValuesModule } from './modules/attribute_values/attribute_values.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ProductAttributesModule } from './modules/product_attributes/product_attributes.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { OrderProductDetailsModule } from './modules/order_product_details/order_product_details.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductVariantsModule } from './modules/product_variants/product_variants.module';
import { VariantAttributeValuesModule } from './modules/variant_attribute_values/variant_attribute_values.module';
import { ProductsModule } from './modules/products/products.module';
import { PromotionalComboDetailsModule } from './modules/promotional_combo_details/promotional_combo_details.module';
import { PromotionalCombosModule } from './modules/promotional_combos/promotional_combos.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { StoreInventoriesModule } from './modules/store_inventories/store_inventories.module';
import { StoresModule } from './modules/stores/stores.module';
import { UsersModule } from './modules/users/users.module';
import { VoucherUserDetailsModule } from './modules/voucher_user_details/voucher_user_details.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { AdsAiModule } from './modules/ads_ai/ads_ai.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { CartsModule } from './modules/carts/carts.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { ChatGatewayModule } from './modules/chat_gateway/chat_gateway.module';
import { ConversationParticipantsModule } from './modules/conversation_participants/conversation_participants.module';
import geminiConfig from './config/gemini.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [geminiConfig],
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
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AddressesModule,
    AnalyticsModule,
    BannersModule,
    BranchesModule,
    CategoriesModule,
    AttributesModule,
    AttributeValuesModule,
    BrandsModule,
    ProductAttributesModule,
    ProductsModule,
    ProductVariantsModule,
    VariantAttributeValuesModule,
    InteractionsModule,
    OrderProductDetailsModule,
    OrdersModule,
    PromotionalComboDetailsModule,
    PromotionalCombosModule,
    RatingsModule,
    StoreInventoriesModule,
    StoresModule,
    VoucherUserDetailsModule,
    VouchersModule,
    AdsAiModule,
    GeminiModule,
    ConversationsModule,
    MessagesModule,
    CartsModule,
    ChatGatewayModule,
    ConversationParticipantsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
