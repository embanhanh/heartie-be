import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';

import { UploadModule } from '../upload/upload.module';
import { UserCustomerGroupsModule } from '../user_customer_groups/user_customer_groups.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UploadModule, UserCustomerGroupsModule],
  providers: [UsersService],
  exports: [UsersService], // Export service để AuthModule có thể dùng
  controllers: [UsersController],
})
export class UsersModule {}
