// services/api/src/reviews/reviews.service.ts

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
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
      .select('id, client_id, salon_id, status')
      .eq('id', dto.reservationId)
      .single();

    if (!reservation) {
      throw new BadRequestException('Reservation not found');
    }

    if (reservation.client_id !== clientId) {
      throw new ForbiddenException('You can only review your own reservations');
    }

    if (reservation.status !== 'Completed') {
      throw new BadRequestException('You can only review completed appointments');
    }

    if (reservation.salon_id !== dto.salonId) {
      throw new BadRequestException('Salon ID does not match the reservation');
    }

    // 2. Check if a review already exists for this reservation
    const { data: existingReview } = await this.supabase.adminClient
      .from('reviews')
      .select('id')
      .eq('reservation_id', dto.reservationId)
      .single();

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

    if (error) throw new Error(`Failed to create review: ${error.message}`);
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
}
