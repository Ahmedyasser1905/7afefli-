// services/api/src/salons/salons.service.ts

import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';

@Injectable()
export class SalonsService {
  constructor(private readonly supabase: SupabaseService) {}

  private enrichSalon(salon: any) {
    if (!salon) return salon;

    const open = salon.open_time ? salon.open_time.slice(0, 5) : null;
    const close = salon.close_time ? salon.close_time.slice(0, 5) : null;

    const is_open_24h = (open === '00:00' && close === '00:00') || (open !== null && open === close);
    const is_manually_closed = !!salon.is_manually_closed;

    let is_currently_open = false;

    if (is_manually_closed) {
      is_currently_open = false;
    } else if (is_open_24h) {
      is_currently_open = true;
    } else {
      // Normal schedule check in local Algeria time (UTC+1)
      const today = new Date();
      const utc = today.getTime() + today.getTimezoneOffset() * 60000;
      const algeriaTime = new Date(utc + 3600000); // UTC+1
      const currentDay = algeriaTime.getDay(); // 0=Sun, 1=Mon...
      const currentTimeStr = `${String(algeriaTime.getHours()).padStart(2, '0')}:${String(algeriaTime.getMinutes()).padStart(2, '0')}`;

      const isWorkingDay = salon.working_days ? salon.working_days.includes(currentDay) : true;

      if (isWorkingDay && open && close) {
        if (close < open) {
          is_currently_open = currentTimeStr >= open || currentTimeStr < close;
        } else {
          is_currently_open = currentTimeStr >= open && currentTimeStr < close;
        }
      } else {
        is_currently_open = false;
      }
    }

    let status_label: 'open' | 'closed' | 'open_24h' | 'manually_closed' = 'closed';
    if (is_manually_closed) {
      status_label = 'manually_closed';
    } else if (is_open_24h) {
      status_label = 'open_24h';
    } else if (is_currently_open) {
      status_label = 'open';
    } else {
      status_label = 'closed';
    }

    return {
      ...salon,
      is_open_24h,
      is_currently_open,
      status_label,
    };
  }

  private enrichSalons(salons: any[]) {
    if (!salons) return salons;
    return salons.map(s => this.enrichSalon(s));
  }

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
      // Subscription enforcement: expired salons are hidden from public search
      .neq('subscription_status', 'Expired')
      .order('is_sponsored', { ascending: false })
      .order('average_rating', { ascending: false });

    if (filters.wilaya) {
      query = query.ilike('wilaya', filters.wilaya);
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

    if (error) throw new InternalServerErrorException(`Failed to fetch salons: ${error.message}`);

    return this.enrichSalons(data);
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

      if (fallbackError) throw new InternalServerErrorException(`Failed to fetch nearby salons: ${fallbackError.message}`);
      return this.enrichSalons(fallbackData);
    }

    return this.enrichSalons(data);
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

    return this.enrichSalon(data);
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
    return this.enrichSalon(data);
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
        trial_ends_at: new Date(
          Date.now() + parseInt(process.env.TRIAL_DAYS ?? '90', 10) * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(`Failed to create salon: ${error.message}`);
    return this.enrichSalon(data);
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

    if (error) throw new InternalServerErrorException(`Failed to update salon: ${error.message}`);
    return this.enrichSalon(data);
  }

  /**
   * Add staff to salon
   */
  async addStaff(salonId: string, customName: string, userId: string) {
    // Verify ownership and check plan
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id, subscriptions:user_subscriptions(status, plans(*))')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException(`Salon with ID ${salonId} not found`);
    if (salon.owner_id !== userId) throw new ForbiddenException('You can only add staff to your own salon');

    const subs = salon.subscriptions as any[];
    const sub = subs?.[0];
    const maxBarbers = sub?.plans?.max_barbers ?? 1;

    // Check staff count
    if (maxBarbers !== -1) {
      const { count } = await this.supabase.adminClient
        .from('salon_staff')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId);

      if ((count || 0) >= maxBarbers) {
        throw new ForbiddenException(`Votre plan actuel est limité à ${maxBarbers} coiffeur(s). Passez à un plan supérieur.`);
      }
    }

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

    if (error) throw new InternalServerErrorException(`Failed to add staff: ${error.message}`);
    return data;
  }

  async getStaff(salonId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('salon_staff')
      .select('*, profiles:profile_id(full_name, avatar_url, phone_number)')
      .eq('salon_id', salonId);
    if (error) throw new InternalServerErrorException(error.message);
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
    if (error) throw new InternalServerErrorException(error.message);
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
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  async getPortfolio(salonId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('portfolio_photos')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });
    if (error && error.code !== '42P01') throw new InternalServerErrorException(error.message);
    
    return (data || []).map((photo: { id: string; url: string; salon_id: string; created_at: string; storage_path: string }) => ({
      ...photo,
      url: this.supabase.adminClient.storage
        .from('portfolio')
        .getPublicUrl(photo.storage_path).data.publicUrl,
    }));
  }

  async addPortfolioPhoto(salonId: string, storagePath: string, userId: string) {
    // Verify ownership and check plan
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id, subscriptions:user_subscriptions(status, plans(*))')
      .eq('id', salonId)
      .single();

    if (!salon || salon.owner_id !== userId) throw new ForbiddenException('Accès refusé');

    const subs = salon.subscriptions as any[];
    const sub = subs?.[0];
    const maxPhotos = sub?.plans?.max_portfolio_photos ?? 3;

    if (maxPhotos !== -1) {
      const { count } = await this.supabase.adminClient
        .from('portfolio_photos')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId);

      if ((count || 0) >= maxPhotos) {
        throw new ForbiddenException(`Votre plan actuel est limité à ${maxPhotos} photo(s). Passez à un plan supérieur.`);
      }
    }

    const { data, error } = await this.supabase.adminClient
      .from('portfolio_photos')
      .insert({ salon_id: salonId, uploader_id: userId, storage_path: storagePath })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
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
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  /**
   * Generate a Supabase signed upload URL for portfolio photos.
   * Checks plan quota before issuing the URL so direct uploads still respect limits.
   */
  async getPortfolioUploadUrl(salonId: string, fileName: string, userId: string) {
    // Verify ownership and check plan quota
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id, subscriptions:user_subscriptions(status, plans(*))')
      .eq('id', salonId)
      .single();

    if (!salon || salon.owner_id !== userId) throw new ForbiddenException('Accès refusé');

    const subs = salon.subscriptions as any[];
    const sub = subs?.[0];
    const maxPhotos = sub?.plans?.max_portfolio_photos ?? 3;

    if (maxPhotos !== -1) {
      const { count } = await this.supabase.adminClient
        .from('portfolio_photos')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId);

      if ((count || 0) >= maxPhotos) {
        throw new ForbiddenException(`Votre plan actuel est limité à ${maxPhotos} photo(s). Passez à un plan supérieur.`);
      }
    }

    // Generate a signed upload URL (valid 5 minutes)
    const storagePath = `${salonId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await this.supabase.adminClient.storage
      .from('portfolio')
      .createSignedUploadUrl(storagePath);

    if (error) throw new InternalServerErrorException(`Impossible de générer l'URL d'upload: ${error.message}`);

    return {
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
    };
  }

  /**
   * Get reviews for a salon (with client profile data).
   */
  async getReviews(salonId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('reviews')
      .select('*, profiles:client_id(full_name, avatar_url)')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });

    if (error && error.code !== '42P01') throw new InternalServerErrorException(error.message);
    return data || [];
  }

  /**
   * Get dashboard statistics for a salon owner.
   */
  async getDashboardStats(ownerId: string, period: string, date?: string) {
    // 1. Find the salon by owner_id and its subscription limits
    const { data: salon, error: salonError } = await this.supabase.adminClient
      .from('salons')
      .select('id, subscriptions:user_subscriptions(status, plans(*))')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (salonError || !salon) {
      throw new NotFoundException('Salon not found for this owner');
    }

    const subs = (salon as any).subscriptions as any[];
    const sub = subs?.[0];
    const advancedStats = sub?.plans?.advanced_statistics ?? false;

    if (!advancedStats) {
      throw new ForbiddenException("Les statistiques avancées nécessitent le plan Pro ou Premium.");
    }

    // 2. Build query for reservations
    let query = this.supabase.adminClient
      .from('reservations')
      .select('id, status, client_id, notes, service_id')
      .eq('salon_id', salon.id)
      .not('notes', 'ilike', '%CRÉNEAU BLOQUÉ%');

    // 3. Apply period filter
    const filterDate = date || new Date().toISOString().split('T')[0];
    if (period === 'day') {
      query = query.eq('appointment_date', filterDate);
    } else if (period === 'month') {
      const yearMonth = filterDate.substring(0, 7); // YYYY-MM
      query = query.gte('appointment_date', `${yearMonth}-01`)
                   .lte('appointment_date', `${yearMonth}-31`);
    }
    // 'all' → no date filter

    const { data: reservations, error: resError } = await query;

    if (resError) {
      throw new BadRequestException(`Failed to fetch reservations: ${resError.message}`);
    }

    const rows = reservations || [];

    // 4. Calculate stats
    const confirmedOrCompleted = rows.filter(
      (r) => r.status === 'Confirmed' || r.status === 'Completed',
    );
    const pendingRows = rows.filter((r) => r.status === 'Pending');
    const completedRows = rows.filter((r) => r.status === 'Completed');
    const cancelledRows = rows.filter((r) => r.status === 'Cancelled');

    // Distinct client_id count
    const clientIds = new Set(
      confirmedOrCompleted.map((r) => r.client_id).filter(Boolean),
    );

    // 5. Fetch service prices for revenue calculation
    const serviceIds = [
      ...new Set(confirmedOrCompleted.map((r) => r.service_id).filter(Boolean)),
    ];

    let revenue = 0;
    if (serviceIds.length > 0) {
      const { data: services } = await this.supabase.adminClient
        .from('services')
        .select('id, price')
        .in('id', serviceIds);

      if (services) {
        const priceMap = new Map(services.map((s) => [s.id, s.price ?? 0]));
        revenue = confirmedOrCompleted.reduce(
          (sum, r) => sum + (priceMap.get(r.service_id) || 0),
          0,
        );
      }
    }

    return {
      totalBookings: confirmedOrCompleted.length,
      pendingBookings: pendingRows.length,
      completedBookings: completedRows.length,
      cancelledBookings: cancelledRows.length,
      revenue,
      clientCount: clientIds.size,
      period,
      date: filterDate,
    };
  }
}
