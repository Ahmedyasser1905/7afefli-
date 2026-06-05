// services/api/src/subscriptions/subscriptions.controller.ts

import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SupabaseAuthGuard, AuthenticatedUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('subscriptions')
@UseGuards(SupabaseAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * GET /subscriptions/my-plan
   * Get the subscription plan for the authenticated owner's salon.
   */
  @Get('my-plan')
  getMyPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMyPlan(user.id);
  }
}
