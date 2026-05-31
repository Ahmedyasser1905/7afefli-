// services/api/src/reservations/reservations.service.ts
// Handles reservation creation with anti-double-booking trigger error handling

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';

@Injectable()
export class ReservationsService {
  constructor(private readonly supabase: SupabaseService) {}

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
    const endTime = this.addMinutesToTime(dto.startTime, service.duration_minutes);

    // 3. Insert reservation — the DB trigger will prevent double-booking
    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .insert({
        client_id: clientId,
        salon_id: dto.salonId,
        service_id: dto.serviceId,
        barber_id: dto.barberId ?? null,
        appointment_date: dto.appointmentDate,
        start_time: dto.startTime,
        end_time: endTime,
        status: 'Pending',
        notes: dto.notes ?? null,
      })
      .select(`
        *,
        services(service_name, price, duration_minutes),
        salons(name, address, wilaya)
      `)
      .single();

    if (error) {
      // PostgreSQL trigger raised SQLSTATE P0001 — booking conflict
      if (error.code === 'P0001' || error.message?.includes('BOOKING_CONFLICT')) {
        throw new ConflictException(
          'This time slot is no longer available. Please select another.',
        );
      }
      throw new Error(`Reservation failed: ${error.message}`);
    }

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
        services(service_name, price, duration_minutes),
        salons(name, address, wilaya)
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
  async findBySalon(salonId: string, userId: string) {
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

    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        profiles!reservations_client_id_fkey(full_name, phone_number, avatar_url),
        services(service_name, price, duration_minutes)
      `)
      .eq('salon_id', salonId)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

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
    const isBarber = (reservation as any).salons?.owner_id === userId;

    if (!isClient && !isBarber) {
      throw new ForbiddenException('You are not authorized to update this reservation');
    }

    // Clients can only cancel their own pending reservations
    if (isClient && !isBarber) {
      if (dto.status !== 'Cancelled') {
        throw new ForbiddenException('Clients can only cancel reservations');
      }
      if (reservation.status !== 'Pending') {
        throw new BadRequestException('Only pending reservations can be cancelled by clients');
      }
    }

    const updateData: Record<string, any> = { status: dto.status };

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
   * Add minutes to a time string "HH:MM" and return "HH:MM".
   */
  private addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const newM = (totalMinutes % 60).toString().padStart(2, '0');
    return `${newH}:${newM}`;
  }
}
