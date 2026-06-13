// services/api/src/subscriptions/subscriptions.controller.ts

import {
  Controller,
  Get,
  UseGuards,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { SupabaseAuthGuard, AuthenticatedUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /subscriptions/plans
   * Public catalog of active subscription plans.
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

  /**
   * GET /subscriptions/my-client-plan
   * Get the subscription plan for the authenticated client user.
   */
  @Get('my-client-plan')
  @UseGuards(SupabaseAuthGuard)
  getMyClientPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMyClientPlan(user.id);
  }

  /**
   * GET /subscriptions/cron/expire
   * Vercel Cron Job endpoint — fires daily at 02:00 UTC to expire subscriptions.
   * NOT protected by SupabaseAuthGuard (cron has no user JWT).
   * Protected by the CRON_SECRET header sent automatically by Vercel.
   *
   * This replaces the @Cron(EVERY_DAY_AT_MIDNIGHT) decorator on
   * SubscriptionsService.handleDailySubscriptionChecks(), which silently
   * never fires on Vercel's serverless infrastructure.
   *
   * Set CRON_SECRET in Vercel environment variables to secure this endpoint.
   */
  @Get('cron/expire')
  @HttpCode(HttpStatus.OK)
  async cronExpireSubscriptions(
    @Headers('authorization') authHeader?: string,
  ) {
    const cronSecret = this.configService.get<string>('CRON_SECRET');
    if (cronSecret) {
      const token = authHeader?.replace('Bearer ', '');
      if (token !== cronSecret) {
        throw new UnauthorizedException('Invalid cron secret');
      }
    }
    await this.subscriptionsService.handleDailySubscriptionChecks();
    return { ok: true, message: 'Subscription expiry check completed' };
  }
}
