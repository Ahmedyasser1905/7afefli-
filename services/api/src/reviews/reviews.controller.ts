// services/api/src/reviews/reviews.controller.ts

import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { RespondReviewDto } from './dto/respond-review.dto';
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
   * PATCH /reviews/:id/response
   * Add a response to a review (Coiffeur only — must own the salon).
   */
  @Patch('reviews/:id/response')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  addResponse(
    @Param('id') id: string,
    @Body() dto: RespondReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.addResponse(id, user.id, dto.response);
  }
}
