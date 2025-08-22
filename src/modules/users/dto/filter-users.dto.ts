import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FilterUserDto {
  @ApiProperty({
    description: 'Email của user',
    example: 'user@example.com',
    required: false,
    type: String,
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Tên của user',
    example: 'John Doe',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
