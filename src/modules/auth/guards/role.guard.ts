import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

interface RequestUser {
  id: number;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

interface RequestWithUser {
  user?: RequestUser;
  [key: string]: unknown;
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request?.user;

    console.log('🔍 RoleGuard - User object:', user);
    console.log('🔍 RoleGuard - Required roles:', requiredRoles);

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.role) {
      throw new ForbiddenException('Missing user role for authorization');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
