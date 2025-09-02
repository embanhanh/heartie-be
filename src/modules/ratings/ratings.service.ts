import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { CreateRatingDto } from './dto/create-rating.dto';
// import { UpdateRatingDto } from './dto/update-rating.dto';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { BadRequestException, ConflictException } from '@nestjs/common';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,

    @InjectRepository(Product)
    private productRepository: Repository<Product>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createDto: CreateRatingDto): Promise<Rating> {
    // Validate Product exists
    const product = await this.productRepository.findOne({
      where: { id: createDto.idProduct },
    });

    if (!product) {
      throw new BadRequestException(`Product with ID ${createDto.idProduct} does not exist`);
    }

    // Validate User exists
    const user = await this.userRepository.findOne({
      where: { id: createDto.idUser },
    });

    if (!user) {
      throw new BadRequestException(`User with ID ${createDto.idUser} does not exist`);
    }

    // Check if user already rated this product
    const existingRating = await this.ratingRepository.findOne({
      where: {
        idProduct: createDto.idProduct,
        idUser: createDto.idUser,
      },
    });

    if (existingRating) {
      throw new ConflictException(
        `User ${createDto.idUser} has already rated product ${createDto.idProduct}`,
      );
    }

    // Validate rating value
    if (createDto.rating < 1.0 || createDto.rating > 5.0) {
      throw new BadRequestException('Rating must be between 1.0 and 5.0');
    }

    // Round rating to 1 decimal place
    const roundedRating = Math.round(createDto.rating * 10) / 10;

    // Create rating
    const rating = this.ratingRepository.create({
      idProduct: createDto.idProduct,
      idUser: createDto.idUser,
      rating: roundedRating,
      comment: createDto.comment?.trim() || null,
    });

    const savedRating = await this.ratingRepository.save(rating);

    // Update product average rating (optional - có thể làm bằng trigger DB)
    // await this.updateProductAverageRating(createDto.idProduct);

    return savedRating;
  }

  findAll() {
    return this.ratingRepository.find();
  }

  findOne(id: number) {
    return this.ratingRepository.findOneBy({ id });
  }

  // update(id: number, dto: UpdateRatingDto) {
  //   return this.repo.update(id, dto);
  // }

  // remove(id: number) {
  //   return this.repo.delete(id);
  // }
}
