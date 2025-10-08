import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ description: 'First name', example: 'Anh', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiProperty({ description: 'Last name', example: 'Nguyen', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({ description: 'Phone number', example: '+84901234567', required: false })
  @IsOptional()
  @IsPhoneNumber('VN')
  phoneNumber?: string;

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
