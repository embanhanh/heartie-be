import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async buildTokens(userId: number, email: string): Promise<AuthTokensDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
          expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRATION_TIME'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRATION_TIME'),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(registerDto);
    return UserResponseDto.from(user);
  }

  async login(loginDto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.usersService.findOneByEmailWithSecrets(loginDto.email);

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    const tokens = await this.buildTokens(user.id, user.email);
    await this.usersService.setCurrentRefreshToken(tokens.refreshToken, user.id);

    return tokens;
  }

  async refreshTokens(userId: number, refreshToken: string): Promise<AuthTokensDto> {
    const user = await this.usersService.findOneByIdWithRefreshToken(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.buildTokens(user.id, user.email);
    await this.usersService.setCurrentRefreshToken(tokens.refreshToken, user.id);
    return tokens;
  }

  async getCurrentUser(userId: number): Promise<UserResponseDto> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return UserResponseDto.from(user);
  }
}
