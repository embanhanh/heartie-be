import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { Interaction } from './entities/interaction.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Interaction, ProductVariant, User])],
  controllers: [InteractionsController],
  providers: [InteractionsService],
})
export class InteractionsModule {}
