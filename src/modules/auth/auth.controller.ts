import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RegisterDto } from './dto/register.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiCreatedResponse({ type: () => UserResponseDto })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập và lấy access/refresh token' })
  @ApiOkResponse({ type: () => AuthTokensDto })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: () => UserResponseDto })
  me(@Req() req: Request) {
    const user = req.user as { id: number };
    console.log('Fetching current user with id:', user.id);
    return this.authService.getCurrentUser(user.id);
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới cặp token mới từ refresh token' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: () => AuthTokensDto })
  refreshTokens(@Req() req: Request) {
    const user = req.user as { sub: number; refreshToken: string };
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }
}
