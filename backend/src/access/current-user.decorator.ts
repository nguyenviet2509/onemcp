import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedRequest, RequestUser } from '../common/user-request';

// Param decorator: @CurrentUser() user: RequestUser
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user;
  },
);
