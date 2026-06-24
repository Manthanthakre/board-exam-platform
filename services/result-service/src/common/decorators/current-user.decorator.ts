import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthUser {
  sub: string;
  id: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: Record<string, string> }>();
    const u = request.user;
    // JWT payload uses `sub` as the user id
    return { ...u, id: u['sub'], sub: u['sub'], email: u['email'], role: u['role'] };
  },
);
