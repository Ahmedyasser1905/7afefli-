// services/api/src/salons/salons.service.ts

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';

@Injectable()
export class SalonsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * List approved salons with optional filtering.
   */
  async findAll(filters: {
    wilaya?: string;
    search?: string;
    sponsored?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = this.supabase.adminClient
      .from('salons')
      .select('*, services(*)', { count: 'exact' })
      .eq('is_approved', true)
      .order('is_sponsored', { ascending: false })
      .order('average_rating', { ascending: false });

    if (filters.wilaya) {
      query = query.eq('wilaya', filters.wilaya);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    if (filters.sponsored) {
      query = query.eq('is_sponsored', true).gte('sponsored_until', new Date().toISOString());
    }

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch salons: ${error.message}`);

    return { data, total: count, limit, offset };
  }

  /**
   * Find salons near a geographic point using PostGIS.
   */
  async findNearby(lat: number, lng: number, radiusKm: number = 10, limit: number = 20) {
    const radiusMeters = radiusKm * 1000;

    const { data, error } = await this.supabase.adminClient
      .rpc('find_nearby_salons', {
        user_lat: lat,
        user_lng: lng,
        radius_meters: radiusMeters,
        result_limit: limit,
      });

    // Fallback to basic query if RPC doesn't exist yet
    if (error) {
      const { data: fallbackData, error: fallbackError } = await this.supabase.adminClient
        .from('salons')
        .select('*')
        .eq('is_approved', true)
        .order('average_rating', { ascending: false })
        .limit(limit);

      if (fallbackError) throw new Error(`Failed to fetch nearby salons: ${fallbackError.message}`);
      return fallbackData;
    }

    return data;
  }

  /**
   * Get single salon with full details (services included).
   */
  async findOne(id: string) {
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .select(`
        *,
        services(*),
        profiles!salons_owner_id_fkey(full_name, phone_number, avatar_url),
        salon_staff(*, profiles(full_name, avatar_url)),
        portfolio_photos(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Salon with ID ${id} not found`);
    }

    return data;
  }

  /**
   * Create a new salon (for Coiffeur users).
   */
  async create(dto: CreateSalonDto, ownerId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .insert({
        owner_id: ownerId,
        name: dto.name,
        description: dto.description,
        wilaya: dto.wilaya,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        open_time: dto.open_time ?? '09:00',
        close_time: dto.close_time ?? '21:00',
        working_days: dto.working_days ?? [1, 2, 3, 4, 5, 6],
        subscription_status: 'Trial',
        trial_ends_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months trial
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create salon: ${error.message}`);
    return data;
  }

  /**
   * Update salon details (owner only).
   */
  async update(id: string, dto: UpdateSalonDto, userId: string) {
    // Verify ownership
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!salon) throw new NotFoundException(`Salon with ID ${id} not found`);
    if (salon.owner_id !== userId) throw new ForbiddenException('You can only update your own salon');

    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update salon: ${error.message}`);
    return data;
  }
}
