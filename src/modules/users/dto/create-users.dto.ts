import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email của user',
    example: 'user@example.com',
    required: true,
    type: String,
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Mật khẩu của user',
    example: 'password123',
    required: true,
    type: String,
    minLength: 6,
  })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
