// services/api/src/salons/salons.service.ts

import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
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
        portfolio_photos(*),
        reviews(*, profiles!client_id(full_name, avatar_url))
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Salon with ID ${id} not found`);
    }

    return data;
  }

  /**
   * Find salon by owner ID
   */
  async findByOwner(ownerId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) throw new NotFoundException(`Error fetching salon for owner ${ownerId}`);
    if (!data) throw new NotFoundException(`Salon for owner ${ownerId} not found`);
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

  /**
   * Add staff to salon
   */
  async addStaff(salonId: string, customName: string, userId: string) {
    // Verify ownership
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException(`Salon with ID ${salonId} not found`);
    if (salon.owner_id !== userId) throw new ForbiddenException('You can only add staff to your own salon');

    // Check if already a staff member by custom name
    const { data: existing } = await this.supabase.adminClient
      .from('salon_staff')
      .select('id')
      .eq('salon_id', salonId)
      .ilike('custom_name', customName)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new ConflictException('Ce barbier fait déjà partie de votre équipe.');
    }

    const { data, error } = await this.supabase.adminClient
      .from('salon_staff')
      .insert({
        salon_id: salonId,
        profile_id: null,
        custom_name: customName,
        role: 'barber',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add staff: ${error.message}`);
    return data;
  }

  async getStaff(salonId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('salon_staff')
      .select('*, profiles:profile_id(full_name, avatar_url, phone_number)')
      .eq('salon_id', salonId);
    if (error) throw new Error(error.message);
    return data;
  }

  async removeStaff(salonId: string, staffId: string, userId: string) {
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();
    if (!salon || salon.owner_id !== userId) throw new ForbiddenException();

    const { error } = await this.supabase.adminClient
      .from('salon_staff')
      .delete()
      .eq('id', staffId)
      .eq('salon_id', salonId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  async updateStaffAvatar(salonId: string, staffId: string, avatarUrl: string, userId: string) {
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();
    if (!salon || salon.owner_id !== userId) throw new ForbiddenException();

    const { error } = await this.supabase.adminClient
      .from('salon_staff')
      .update({ avatar_url: avatarUrl })
      .eq('id', staffId)
      .eq('salon_id', salonId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  async getPortfolio(salonId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('portfolio_photos')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });
    if (error && error.code !== '42P01') throw new Error(error.message);
    
    return (data || []).map((photo: { id: string; url: string; salon_id: string; created_at: string; storage_path: string }) => ({
      ...photo,
      url: this.supabase.adminClient.storage
        .from('portfolio')
        .getPublicUrl(photo.storage_path).data.publicUrl,
    }));
  }

  async addPortfolioPhoto(salonId: string, storagePath: string, userId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('portfolio_photos')
      .insert({ salon_id: salonId, uploader_id: userId, storage_path: storagePath })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async removePortfolioPhoto(salonId: string, photoId: string, userId: string) {
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();
    if (!salon || salon.owner_id !== userId) throw new ForbiddenException();

    const { error } = await this.supabase.adminClient
      .from('portfolio_photos')
      .delete()
      .eq('id', photoId)
      .eq('salon_id', salonId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
