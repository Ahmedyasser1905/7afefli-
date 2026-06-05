// services/api/src/subscriptions/subscriptions.controller.ts

import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SupabaseAuthGuard, AuthenticatedUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * GET /subscriptions/plans
   * Public catalog of active subscription plans.
   * No auth required — plans are public information.
   */
  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  /**
   * GET /subscriptions/my-plan
   * Get the subscription plan for the authenticated owner's salon.
   */
  @Get('my-plan')
  @UseGuards(SupabaseAuthGuard)
  getMyPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMyPlan(user.id);
  }
}
