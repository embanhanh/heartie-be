import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-users.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUsersDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Mật khẩu của user',
    example: 'password123',
    required: false,
    type: String,
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
