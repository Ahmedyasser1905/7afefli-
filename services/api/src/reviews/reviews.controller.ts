// services/api/src/reviews/reviews.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.guard';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /reviews
   * Submit a review for a completed appointment (Client only).
   */
  @Post('reviews')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Client')
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.create(dto, user.id);
  }

  /**
   * GET /salons/:salonId/reviews
   * Get reviews for a salon (public).
   */
  @Get('salons/:salonId/reviews')
  findBySalon(
    @Param('salonId') salonId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.reviewsService.findBySalon(salonId, limit, offset);
  }
}
