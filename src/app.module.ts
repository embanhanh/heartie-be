import type { SharedBullAsyncConfiguration } from '@nestjs/bullmq';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedI18nModule } from './common/i18n/shared-i18n.module';
import { AppLoggerModule } from './common/logger/app-logger.module';
import firebaseConfig from './config/firebase.config';
import geminiConfig from './config/gemini.config';
import { enablePostgresVectorType } from './database/postgres-vector.util';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminCopilotModule } from './modules/admin_copilot/admin-copilot.module';
import { AdsAiModule } from './modules/ads_ai/ads_ai.module';
import { AiCustomerModule } from './modules/ai_customer/ai-customer.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AttributeValuesModule } from './modules/attribute_values/attribute_values.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { AuthModule } from './modules/auth/auth.module';
import { BannersModule } from './modules/banners/banners.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CartItemsModule } from './modules/cart_items/cart-items.module';
import { CartsModule } from './modules/carts/carts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ChatGatewayModule } from './modules/chat_gateway/chat_gateway.module';
import { ConversationParticipantsModule } from './modules/conversation_participants/conversation_participants.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { CustomerGroupsModule } from './modules/customer_groups/customer_groups.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { CollectionProductsModule } from './modules/collection_products/collection_products.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { ImageSearchModule } from './modules/image_search/image-search.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrderItemsModule } from './modules/order_items/order_items.module';
import { OrderProductDetailsModule } from './modules/order_product_details/order_product_details.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ProductAttributesModule } from './modules/product_attributes/product_attributes.module';
import { ProductVariantsModule } from './modules/product_variants/product_variants.module';
import { ProductsModule } from './modules/products/products.module';
import { PromotionalComboDetailsModule } from './modules/promotional_combo_details/promotional_combo_details.module';
import { PromotionalCombosModule } from './modules/promotional_combos/promotional_combos.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { ReviewAnalysisModule } from './modules/review_analysis/review-analysis.module';
import { SemanticSearchModule } from './modules/semantic_search/semantic-search.module';
import { StatsModule } from './modules/stats/stats.module';
import { TrendForecastingModule } from './modules/trend_forecasting/trend-forecasting.module';
import { UploadModule } from './modules/upload/upload.module';
import { UserCustomerGroupsModule } from './modules/user_customer_groups/user_customer_groups.module';
import { UsersModule } from './modules/users/users.module';
import { VariantAttributeValuesModule } from './modules/variant_attribute_values/variant_attribute_values.module';
import { VisionModule } from './modules/vision/vision.module';
import { VoucherUserDetailsModule } from './modules/voucher_user_details/voucher_user_details.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { MomoModule } from './modules/momo/momo.module';

const BullModuleTyped = BullModule as unknown as {
  forRootAsync: (config: SharedBullAsyncConfiguration) => DynamicModule;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [geminiConfig, firebaseConfig],
    }),
    AppLoggerModule,
    SharedI18nModule,
    BullModuleTyped.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
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
      dataSourceFactory: async (options?: DataSourceOptions) => {
        if (!options) {
          throw new Error('TypeORM options were not provided');
        }

        const dataSource = new DataSource(options);
        enablePostgresVectorType(dataSource);
        return dataSource.initialize();
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AddressesModule,
    AnalyticsModule,
    StatsModule,
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
    CollectionsModule,
    CollectionProductsModule,
    InteractionsModule,
    OrderProductDetailsModule,
    OrdersModule,
    PromotionalComboDetailsModule,
    PromotionalCombosModule,
    PromotionsModule,
    CustomerGroupsModule,
    UserCustomerGroupsModule,
    RatingsModule,
    VoucherUserDetailsModule,
    VouchersModule,
    AdsAiModule,
    CartsModule,
    CartItemsModule,
    GeminiModule,
    ConversationsModule,
    MessagesModule,
    CartsModule,
    ChatGatewayModule,
    ConversationParticipantsModule,
    OrderItemsModule,
    PricingModule,
    SemanticSearchModule,
    ReviewAnalysisModule,
    TrendForecastingModule,
    AdminCopilotModule,
    AiCustomerModule,
    NotificationsModule,
    VisionModule,
    ImageSearchModule,
    UploadModule,
    FavoritesModule,
    MomoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
