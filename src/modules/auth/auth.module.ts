import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AccessTokenStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/jwt-refresh.strategy';
import { AdminGuard } from './guards/admin.guard';
import { RoleGuard } from './guards/role.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}), // Để trống vì chúng ta sẽ cung cấp secrets trong service
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    AdminGuard,
    RoleGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [AdminGuard, RoleGuard, OptionalJwtAuthGuard, JwtModule],
})
export class AuthModule {}
