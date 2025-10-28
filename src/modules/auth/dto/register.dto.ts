import { IsOptional, IsEnum } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto extends CreateUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
