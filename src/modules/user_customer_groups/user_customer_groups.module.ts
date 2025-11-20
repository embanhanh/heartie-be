import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCustomerGroupsController } from './user_customer_groups.controller';
import { UserCustomerGroupsService } from './user_customer_groups.service';
import { UserCustomerGroup } from './entities/user-customer-group.entity';
import { User } from '../users/entities/user.entity';
import { CustomerGroup } from '../customer_groups/entities/customer-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserCustomerGroup, User, CustomerGroup])],
  controllers: [UserCustomerGroupsController],
  providers: [UserCustomerGroupsService],
  exports: [UserCustomerGroupsService, TypeOrmModule],
})
export class UserCustomerGroupsModule {}
