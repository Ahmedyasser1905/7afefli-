// services/api/src/auth/decorators/current-user.decorator.ts
// Extracts the authenticated user from the request

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../auth.guard';

/**
 * Parameter decorator to extract the authenticated user from the request.
 * 
 * Usage:
 * ```
 * @Get('me')
 * getMe(@CurrentUser() user: AuthenticatedUser) { ... }
 * 
 * @Get('me')
 * getMyId(@CurrentUser('id') userId: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    return data ? user?.[data] : user;
  },
);
