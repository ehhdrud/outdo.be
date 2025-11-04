import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserPayload {
  user_pk: number;
  email: string;
}

export const User = createParamDecorator((data: unknown, ctx: ExecutionContext): UserPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

