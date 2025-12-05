import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../users/entities/user.entity';

type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET must be defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => RefreshTokenStrategy.extractTokenFromBody(req),
        (req: Request) => RefreshTokenStrategy.extractTokenFromCookies(req),
      ]),
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const refreshToken =
      RefreshTokenStrategy.extractTokenFromHeader(req) ??
      RefreshTokenStrategy.extractTokenFromBody(req) ??
      RefreshTokenStrategy.extractTokenFromCookies(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    return { ...payload, refreshToken };
  }

  private static extractTokenFromHeader(req: Request): string | null {
    const authHeader = req.get('Authorization') ?? req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }
    const token = authHeader.replace(/Bearer\s*/i, '').trim();
    return token.length > 0 ? token : null;
  }

  private static extractTokenFromBody(req: Request): string | null {
    const candidate = (req.body as Record<string, unknown>)?.refreshToken;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
    return null;
  }

  private static extractTokenFromCookies(req: Request): string | null {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const candidate = cookies?.refreshToken ?? cookies?.RefreshToken ?? cookies?.refresh;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
    return null;
  }
}
