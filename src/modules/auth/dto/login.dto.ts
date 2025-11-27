import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Email đăng nhập', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Mật khẩu đăng nhập', example: 'Password@123', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
