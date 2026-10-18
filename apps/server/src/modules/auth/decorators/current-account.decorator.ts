import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthenticatedAccount {
  id: string;
  email: string;
}

export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAccount => {
    const request = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedAccount;
    }>();

    if (!request.user) {
      throw new Error('当前账号装饰器只能用于已认证路由');
    }

    return request.user;
  },
);
