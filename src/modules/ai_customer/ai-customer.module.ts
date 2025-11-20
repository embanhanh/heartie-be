import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AiCustomerController } from './ai-customer.controller';
import { AiCustomerService } from './ai-customer.service';

@Module({
  imports: [ProductsModule],
  controllers: [AiCustomerController],
  providers: [AiCustomerService],
  exports: [AiCustomerService],
})
export class AiCustomerModule {}
