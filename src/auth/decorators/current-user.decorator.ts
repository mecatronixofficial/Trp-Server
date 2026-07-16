import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const selectedBranch = request.user?.role === 'super_admin'
      ? request.headers['x-branch-id'] || null
      : request.user?.branch || null;
    return { ...request.user, selectedBranch };
  },
);
