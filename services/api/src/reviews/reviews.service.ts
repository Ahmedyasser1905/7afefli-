// services/api/src/reviews/reviews.service.ts

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Submit a review — only for a Completed reservation by the client who booked it.
   */
  async create(dto: CreateReviewDto, clientId: string) {
    // 1. Verify the reservation exists, belongs to this client, and is Completed
    const { data: reservation } = await this.supabase.adminClient
      .from('reservations')
      .select('id, client_id, salon_id, status, appointment_date, end_time')
      .eq('id', dto.reservationId)
      .single();

    if (!reservation) {
      throw new BadRequestException('Reservation not found');
    }

    if (reservation.client_id !== clientId) {
      throw new ForbiddenException('You can only review your own reservations');
    }

    let isReviewable = reservation.status === 'Completed';

    if (reservation.status === 'Confirmed') {
      const algNow = new Date(Date.now() + 60 * 60 * 1000); // UTC+1
      const todayAlg = algNow.toISOString().split('T')[0];
      const nowStr = `${String(algNow.getUTCHours()).padStart(2, '0')}:${String(algNow.getUTCMinutes()).padStart(2, '0')}`;

      const apptDate = reservation.appointment_date;
      const endTime = reservation.end_time ? reservation.end_time.slice(0, 5) : null;

      if (apptDate < todayAlg || (apptDate === todayAlg && endTime && endTime < nowStr)) {
        isReviewable = true;
      }
    }

    if (!isReviewable) {
      throw new BadRequestException('You can only review completed or expired appointments');
    }

    if (reservation.salon_id !== dto.salonId) {
      throw new BadRequestException('Salon ID does not match the reservation');
    }

    // 2. Check if a review already exists for this reservation
    const { data: existingReview } = await this.supabase.adminClient
      .from('reviews')
      .select('id')
      .eq('reservation_id', dto.reservationId)
      .maybeSingle();

    if (existingReview) {
      throw new ConflictException('You have already reviewed this appointment');
    }

    // 3. Create the review — the DB trigger will auto-update salon's average_rating
    const { data, error } = await this.supabase.adminClient
      .from('reviews')
      .insert({
        reservation_id: dto.reservationId,
        client_id: clientId,
        salon_id: dto.salonId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        throw new ConflictException('You have already reviewed this appointment');
      }
      throw new Error(`Failed to create review: ${error.message}`);
    }
    return data;
  }

  /**
   * Get all reviews for a salon (public).
   */
  async findBySalon(salonId: string, limit: number = 20, offset: number = 0) {
    const { data, error, count } = await this.supabase.adminClient
      .from('reviews')
      .select(
        '*, profiles!reviews_client_id_fkey(full_name, avatar_url)',
        { count: 'exact' },
      )
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
    return { data, total: count, limit, offset };
  }

  /**
   * Add a response to a review (salon owner only).
   * Verifies ownership through review → salon → owner_id chain.
   */
  async addResponse(reviewId: string, ownerId: string, response: string) {
    // 1. Fetch the review with its salon
    const { data: review, error: fetchError } = await this.supabase.adminClient
      .from('reviews')
      .select('id, salon_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !review) {
      throw new NotFoundException('Review not found');
    }

    // 2. Verify salon ownership
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', review.salon_id)
      .single();

    if (!salon || salon.owner_id !== ownerId) {
      throw new ForbiddenException('You can only respond to reviews for your own salon');
    }

    // 3. Update the review with the response
    const { data, error } = await this.supabase.adminClient
      .from('reviews')
      .update({
        response,
        response_date: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw new Error(`Failed to add response: ${error.message}`);
    return data;
  }
}
