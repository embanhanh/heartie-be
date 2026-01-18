import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { ProductsModule } from '../products/products.module';
import { Interaction } from '../interactions/entities/interaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Interaction]), ProductsModule],
  providers: [UsersService],
  exports: [UsersService], // Export service để AuthModule có thể dùng
  controllers: [UsersController],
})
export class UsersModule {}
