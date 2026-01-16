import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request?.headers?.authorization;

    if (!authHeader) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = any>(
    err: unknown,
    user: TUser,
    info: unknown,
    _context?: ExecutionContext,
    _status?: unknown,
  ) {
    void _context;
    void _status;

    if (err) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }

    if (info instanceof Error) {
      throw new UnauthorizedException(info.message);
    }

    return user ?? null;
  }
}
