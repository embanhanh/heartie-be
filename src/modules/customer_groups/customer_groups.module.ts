import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerGroup } from './entities/customer-group.entity';
import { CustomerGroupsService } from './customer_groups.service';
import { CustomerGroupsController } from './customer_groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerGroup])],
  controllers: [CustomerGroupsController],
  providers: [CustomerGroupsService],
  exports: [CustomerGroupsService, TypeOrmModule],
})
export class CustomerGroupsModule {}
