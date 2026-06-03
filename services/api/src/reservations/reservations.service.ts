// services/api/src/reservations/reservations.service.ts
// Handles reservation creation with anti-double-booking trigger error handling

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { addMinutesToTime } from '../utils/time.util';
import { AuthenticatedUser } from '../auth/auth.guard';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Create a reservation.
   * Auto-calculates end_time from start_time + service duration.
   * Handles BOOKING_CONFLICT from the PostgreSQL overlap trigger.
   */
  async create(dto: CreateReservationDto, clientId: string) {
    // 1. Fetch service duration to calculate end_time
    const { data: service, error: serviceError } = await this.supabase.adminClient
      .from('services')
      .select('duration_minutes')
      .eq('id', dto.serviceId)
      .eq('salon_id', dto.salonId)
      .single();

    if (serviceError || !service) {
      throw new BadRequestException('Service not found for this salon');
    }

    // 2. Calculate end_time from start_time + duration
    const endTime = addMinutesToTime(dto.startTime, service.duration_minutes);

    // Resolve staffId (salon_staff.id) and profileId (profiles.id) from dto.barberId
    let staffId: string | null = null;
    let profileId: string | null = null;

    if (dto.barberId) {
      // 1. Try to find staff by staff.id
      const { data: staffById } = await this.supabase.adminClient
        .from('salon_staff')
        .select('id, profile_id')
        .eq('id', dto.barberId)
        .eq('salon_id', dto.salonId)
        .maybeSingle();

      if (staffById) {
        staffId = staffById.id;
        profileId = staffById.profile_id;
      } else {
        // 2. Fallback: try to find staff by profile_id
        const { data: staffByProfile } = await this.supabase.adminClient
          .from('salon_staff')
          .select('id, profile_id')
          .eq('profile_id', dto.barberId)
          .eq('salon_id', dto.salonId)
          .maybeSingle();

        if (staffByProfile) {
          staffId = staffByProfile.id;
          profileId = staffByProfile.profile_id;
        } else {
          throw new BadRequestException('Barber/Staff not found for this salon');
        }
      }
    }

    // 3. Call the safe RPC to prevent double-booking with Advisory Locks
    const { data, error } = await this.supabase.adminClient.rpc(
      'create_reservation_safe',
      {
        p_client_id: clientId,
        p_salon_id: dto.salonId,
        p_service_id: dto.serviceId,
        p_barber_id: profileId,
        p_appointment_date: dto.appointmentDate,
        p_start_time: dto.startTime,
        p_end_time: endTime,
        p_notes: dto.notes ?? null,
        p_client_phone: dto.clientPhone ?? null,
        p_staff_id: staffId,
      }
    );

    if (error) {
      if (error.message?.includes('booked') || error.code === 'P0001') {
        throw new ConflictException(
          'This time slot is no longer available. Please select another.',
        );
      }
      throw new Error(`Reservation failed: ${error.message}`);
    }

    // 4. Invalidate slot cache for this salon/date to reduce stale availability
    // NOTE: prefix must match the one in slots.service.ts (slots_v2)
    const cachePattern = `slots_v2:${dto.salonId}:${dto.serviceId}:${dto.appointmentDate}`;
    try {
      // Wildcard invalidation — delete all barber variants for this date
      await this.cacheManager.del(`${cachePattern}:any`);
      if (dto.barberId) await this.cacheManager.del(`${cachePattern}:${dto.barberId}`);
    } catch {
      // Cache invalidation failure is non-fatal
      this.logger.warn('Slot cache invalidation failed (non-fatal)');
    }

    // 5. Fetch the enriched data
    const { data: enrichedData } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        services(service_name, price, duration_minutes),
        salons(name, address, wilaya)
      `)
      .eq('id', data.id)
      .single();

    return enrichedData || data;
  }

  /**
   * Block a time slot (Coiffeur only).
   */
  async blockTime(
    salonId: string,
    barberId: string,
    appointmentDate: string,
    startTime: string,
    endTime: string,
  ) {
    // Resolve staff_id from profile_id
    const { data: staff } = await this.supabase.adminClient
      .from('salon_staff')
      .select('id')
      .eq('salon_id', salonId)
      .eq('profile_id', barberId)
      .maybeSingle();

    const staffId = staff?.id || null;

    const { data, error } = await this.supabase.adminClient.rpc(
      'create_reservation_safe',
      {
        p_client_id: barberId,
        p_salon_id: salonId,
        p_service_id: null,
        p_barber_id: barberId,
        p_appointment_date: appointmentDate,
        p_start_time: startTime,
        p_end_time: endTime,
        p_notes: 'CRÉNEAU BLOQUÉ',
        p_client_phone: null,
        p_staff_id: staffId,
      }
    );

    if (error) {
      if (error.message?.includes('booked') || error.code === 'P0001') {
        throw new ConflictException(
          'This time slot is no longer available or conflicts with another reservation.',
        );
      }
      throw new Error(`Failed to block time: ${error.message}`);
    }

    // Auto-confirm the blocked time
    await this.supabase.adminClient
      .from('reservations')
      .update({ status: 'Confirmed' })
      .eq('id', data.id);

    return data;
  }

  /**
   * Get all reservations for the authenticated client.
   */
  async findByClient(clientId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        services(id, service_name, price, duration_minutes),
        salons(id, name, address, wilaya, image_url),
        salon_staff:staff_id(custom_name, profiles!profile_id(full_name)),
        reviews(id)
      `)
      .eq('client_id', clientId)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) throw new Error(`Failed to fetch reservations: ${error.message}`);
    return data;
  }

  /**
   * Get all reservations for a salon (barber/owner view).
   */
  async findBySalon(salonId: string, userId: string, date?: string) {
    // Verify the user owns the salon or is staff
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException('Salon not found');

    const isOwner = salon.owner_id === userId;

    if (!isOwner) {
      // Check if user is salon staff
      const { data: staff } = await this.supabase.adminClient
        .from('salon_staff')
        .select('id')
        .eq('salon_id', salonId)
        .eq('profile_id', userId)
        .single();

      if (!staff) {
        throw new ForbiddenException('You are not authorized to view this salon\'s reservations');
      }
    }

    let query = this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        profiles!reservations_client_id_fkey(full_name, phone_number, avatar_url),
        services(service_name, price, duration_minutes),
        salon_staff:staff_id(custom_name, profiles!profile_id(full_name))
      `)
      .eq('salon_id', salonId)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (date) {
      query = query.eq('appointment_date', date);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch salon reservations: ${error.message}`);
    return data;
  }

  /**
   * Update reservation status (confirm, cancel, complete).
   */
  async updateStatus(
    reservationId: string,
    dto: UpdateReservationStatusDto,
    userId: string,
  ) {
    // Fetch existing reservation
    const { data: reservation } = await this.supabase.adminClient
      .from('reservations')
      .select('*, salons(owner_id)')
      .eq('id', reservationId)
      .single();

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    // Verify authorization
    const isClient = reservation.client_id === userId;
    const isBarber = (reservation as unknown as { salons?: { owner_id: string } }).salons?.owner_id === userId;

    let isStaff = false;
    if (!isClient && !isBarber) {
      const { data: staff } = await this.supabase.adminClient
        .from('salon_staff')
        .select('id')
        .eq('salon_id', reservation.salon_id)
        .eq('profile_id', userId)
        .single();
      isStaff = !!staff;
    }

    if (!isClient && !isBarber && !isStaff) {
      throw new ForbiddenException('You are not authorized to update this reservation');
    }

    // Clients can only cancel their own pending reservations
    if (isClient && !isBarber && !isStaff) {
      if (dto.status !== 'Cancelled') {
        throw new ForbiddenException('Clients can only cancel reservations');
      }
      if (reservation.status !== 'Pending') {
        throw new BadRequestException('Only pending reservations can be cancelled by clients');
      }
    }

    const updateData: Record<string, unknown> = { status: dto.status };

    if (dto.status === 'Cancelled') {
      updateData.cancelled_by = userId;
      updateData.cancel_reason = dto.cancel_reason ?? null;
    }

    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update reservation: ${error.message}`);
    return data;
  }

  /**
   * Get a single reservation by ID.
   * SECURITY: Access is restricted to:
   *   - The reservation client (owner)
   *   - The salon owner
   *   - The assigned staff member
   *   - An Admin
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        id, salon_id, client_id, barber_id, appointment_date, start_time, end_time,
        status, notes, cancelled_by, cancel_reason, created_at, updated_at,
        profiles!reservations_client_id_fkey(full_name, phone_number, avatar_url),
        services(service_name, price, duration_minutes),
        salons(id, name, address, wilaya, owner_id)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Reservation not found');
      }
      throw new Error(`Failed to fetch reservation: ${error.message}`);
    }

    // Authorization check
    if (user.role !== 'Admin') {
      const reservation = data as unknown as {
        client_id: string;
        barber_id: string | null;
        salons: { owner_id: string } | null;
      };

      const isClient  = reservation.client_id === user.id;
      const isBarber  = reservation.barber_id === user.id;
      const isOwner   = reservation.salons?.owner_id === user.id;

      // Check if user is salon staff
      let isStaff = false;
      if (!isClient && !isBarber && !isOwner) {
        const salonData = data as unknown as { salon_id: string };
        const { data: staff } = await this.supabase.adminClient
          .from('salon_staff')
          .select('id')
          .eq('salon_id', salonData.salon_id)
          .eq('profile_id', user.id)
          .single();
        isStaff = !!staff;
      }

      if (!isClient && !isBarber && !isOwner && !isStaff) {
        throw new ForbiddenException('You are not authorized to view this reservation');
      }
    }

    return data;
  }

}
