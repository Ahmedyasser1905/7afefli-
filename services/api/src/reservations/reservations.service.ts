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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a reservation.
   * Auto-calculates end_time from start_time + service duration.
   * Handles BOOKING_CONFLICT from the PostgreSQL overlap trigger.
   */
  async create(dto: CreateReservationDto, clientId: string) {
    // 1. Fetch service, salon details, and staff membership in parallel
    // (done first so we know isStaffOrOwner before the past-time guard)
    const [serviceResult, salonResult, staffResult] = await Promise.all([
      this.supabase.adminClient
        .from('services')
        .select('duration_minutes')
        .eq('id', dto.serviceId)
        .eq('salon_id', dto.salonId)
        .single(),
      this.supabase.adminClient
        .from('salons')
        .select('owner_id, is_manually_closed, name, address, wilaya, commune, phone, description, latitude, longitude, open_time, close_time, image_url, services(id), portfolio_photos(id), salon_staff(id), subscriptions:user_subscriptions(status, plans(*))')
        .eq('id', dto.salonId)
        .single(),
      this.supabase.adminClient
        .from('salon_staff')
        .select('id')
        .eq('salon_id', dto.salonId)
        .eq('profile_id', clientId)
        .maybeSingle(),
    ]);

    if (serviceResult.error || !serviceResult.data) {
      throw new BadRequestException('Service not found for this salon');
    }
    if (salonResult.error || !salonResult.data) {
      throw new BadRequestException('Salon not found');
    }

    const salonData = salonResult.data as Record<string, any>;

    // Enforce completeness validation
    const hasName = !!salonData.name;
    const hasAddress = !!salonData.address;
    const hasWilaya = !!salonData.wilaya;
    const hasCommune = !!salonData.commune;
    const hasPhone = !!salonData.phone;
    const hasDesc = !!salonData.description;
    const hasCoords = salonData.latitude !== null && salonData.latitude !== undefined &&
                      salonData.longitude !== null && salonData.longitude !== undefined;
    const hasHours = !!salonData.open_time && !!salonData.close_time;
    const hasLogo = !!salonData.image_url;
    const hasServices = salonData.services && salonData.services.length > 0;
    const hasBarbers = salonData.salon_staff && salonData.salon_staff.length > 0;

    if (!hasName || !hasAddress || !hasWilaya || !hasCommune || !hasPhone || !hasDesc || !hasCoords || !hasHours || !hasLogo || !hasServices || !hasBarbers) {
      throw new BadRequestException("Ce salon n'est pas encore prêt à recevoir des réservations. Le profil doit être complété par le coiffeur (services et coiffeurs requis).");
    }

    if (salonData.is_manually_closed) {
      throw new BadRequestException("Ce salon est temporairement fermé et n'accepte pas de réservations pour le moment.");
    }

    const duration = serviceResult.data.duration_minutes;
    const isStaffOrOwner = salonData.owner_id === clientId || !!staffResult.data;

    // Plan Enforcement: max_reservations
    let maxReservations = 50;
    const subs = salonData.subscriptions as any[];
    const sub = subs?.[0];
    if (sub?.plans) {
      maxReservations = sub.plans.max_reservations;
    } else {
      const { data: defaultPlan } = await this.supabase.adminClient
        .from('plans')
        .select('max_reservations')
        .eq('price', 0)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      maxReservations = defaultPlan?.max_reservations ?? 50;
    }

    if (maxReservations !== -1) {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

      const { count } = await this.supabase.adminClient
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', dto.salonId)
        .gte('appointment_date', firstDayOfMonth)
        .lte('appointment_date', lastDayOfMonth)
        .not('status', 'eq', 'Cancelled')
        .or('notes.is.null,notes.not.ilike.%CRÉNEAU BLOQUÉ%');

      if ((count || 0) >= maxReservations) {
        throw new ForbiddenException(`Ce salon a atteint sa limite mensuelle de réservations (${maxReservations}). Il doit passer à un plan supérieur.`);
      }
    }

    // Validate that the slot is not in the past — only enforced for regular clients.
    // Barbers and salon owners can freely add walk-ins for any time today.
    if (!isStaffOrOwner) {
      const today = new Date();
      const utc = today.getTime() + today.getTimezoneOffset() * 60000;
      const algeriaTime = new Date(utc + 3600000);
      const currentDateStr = `${algeriaTime.getFullYear()}-${String(algeriaTime.getMonth() + 1).padStart(2, '0')}-${String(algeriaTime.getDate()).padStart(2, '0')}`;
      const currentTimeStr = `${String(algeriaTime.getHours()).padStart(2, '0')}:${String(algeriaTime.getMinutes()).padStart(2, '0')}`;

      if (
        dto.appointmentDate < currentDateStr ||
        (dto.appointmentDate === currentDateStr && dto.startTime < currentTimeStr)
      ) {
        throw new BadRequestException('Cannot book a time slot in the past');
      }
    }

    // 2. Calculate end_time from start_time + duration
    const endTime = addMinutesToTime(dto.startTime, duration);

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
        p_is_walk_in: dto.isWalkIn ?? false,
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

    // Auto-confirm the reservation if the creator is a staff member or salon owner
    if (isStaffOrOwner) {
      const { error: updateError } = await this.supabase.adminClient
        .from('reservations')
        .update({ status: 'Confirmed' })
        .eq('id', data.id);
      
      if (!updateError) {
        data.status = 'Confirmed';
      }
    }

    // 4. Invalidate slot cache for this salon/date to reduce stale availability
    await this.invalidateSlotsCache(dto.salonId, dto.serviceId, dto.appointmentDate, dto.barberId);

    // 5. Fetch the enriched data
    const { data: enrichedData } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        services(service_name, price, duration_minutes),
        salons(name, address, wilaya, owner_id)
      `)
      .eq('id', data.id)
      .single();

    const result = enrichedData || data;

    // 6. Push notification: inform the salon owner about the new booking (fire-and-forget)
    try {
      const salonOwnerId = (result as any)?.salons?.owner_id;
      const serviceName = (result as any)?.services?.service_name ?? 'Service';
      const salonName = (result as any)?.salons?.name ?? 'votre salon';
      if (salonOwnerId && salonOwnerId !== clientId) {
        this.notificationsService.createNotification(
          salonOwnerId,
          'new_booking',
          '📅 Nouvelle réservation',
          `Un client a réservé ${serviceName} le ${dto.appointmentDate} à ${dto.startTime}.`,
          { reservationId: data.id, salonId: dto.salonId },
        ).catch(() => {}); // fire-and-forget
      }
    } catch { /* ignore notification failures */ }

    return result;
  }

  /**
   * Block a time slot (Coiffeur only).
   *
   * Uses a DIRECT INSERT (not the conflict-checking RPC) so that:
   *   - Existing reservations during that time are PRESERVED (not cancelled).
   *   - The block is always created regardless of existing bookings.
   *   - The block prevents NEW client reservations because the slots service
   *     marks any slot overlapping a 'Confirmed' reservation for that barber
   *     as unavailable.
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

    // Resolve any service_id from this salon as a fallback in case service_id
    // column has a NOT NULL constraint. The 'CRÉNEAU BLOQUÉ' note identifies this
    // as a block regardless of which service_id is stored.
    let fallbackServiceId: string | null = null;
    const { data: anyService } = await this.supabase.adminClient
      .from('services')
      .select('id')
      .eq('salon_id', salonId)
      .limit(1)
      .maybeSingle();
    fallbackServiceId = anyService?.id ?? null;

    // Check if this time window is already blocked by this barber
    const { data: existingBlock } = await this.supabase.adminClient
      .from('reservations')
      .select('id, start_time, end_time')
      .eq('salon_id', salonId)
      .eq('appointment_date', appointmentDate)
      .eq('status', 'Confirmed')
      .ilike('notes', '%NEAU BLOQU%')
      // fix: avoid dynamic string interpolation in .or() — use explicit filter builder
      .or(
        staffId
          ? `barber_id.eq.${barberId},staff_id.eq.${staffId}`
          : `barber_id.eq.${barberId}`,
        { foreignTable: undefined }
      )
      .lt('start_time', endTime)
      .gt('end_time', startTime)
      .maybeSingle();

    if (existingBlock) {
      throw new ConflictException(
        `Ce créneau est déjà bloqué (${existingBlock.start_time?.slice(0,5)} – ${existingBlock.end_time?.slice(0,5)}). Débloquez-le d'abord si nécessaire.`
      );
    }

    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .insert({
        client_id:        barberId,
        salon_id:         salonId,
        service_id:       fallbackServiceId,   // null if salon has no services yet
        barber_id:        barberId,
        staff_id:         staffId,
        appointment_date: appointmentDate,
        start_time:       startTime,
        end_time:         endTime,
        notes:            'CRÉNEAU BLOQUÉ',
        status:           'Confirmed',
        client_phone:     null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`blockTime insert failed: ${error.message} | code: ${error.code}`);
      // Parse the DB trigger error message to give a cleaner response
      const msg = error.message || '';
      if (msg.toLowerCase().includes('booking_conflict') || msg.toLowerCase().includes('r\u00e9serv\u00e9')) {
        throw new ConflictException(
          'Ce créneau a une réservation client active. Impossible de le bloquer pendant qu\'un client est réservé.'
        );
      }
      throw new BadRequestException(`Impossible de bloquer ce créneau: ${msg}`);
    }

    // Invalidate slot cache for all services in the salon at this date/barber
    await this.invalidateSlotsCache(salonId, null, appointmentDate, barberId);

    return data;
  }

  /**
   * Unblock a time slot — deletes the CRÉNEAU BLOQUÉ reservation.
   * Only the barber who created the block (barber_id === userId) can delete it.
   */
  async unblockTime(reservationId: string, userId: string) {
    const { data: reservation, error: fetchErr } = await this.supabase.adminClient
      .from('reservations')
      .select('id, notes, barber_id, client_id, salon_id, appointment_date')
      .eq('id', reservationId)
      .maybeSingle();

    if (fetchErr || !reservation) throw new NotFoundException('Créneau introuvable');

    if (!reservation.notes?.includes('CRÉNEAU BLOQUÉ')) {
      throw new BadRequestException("Ce n'est pas un créneau bloqué");
    }

    if (reservation.barber_id !== userId && reservation.client_id !== userId) {
      throw new ForbiddenException('Vous ne pouvez débloquer que vos propres créneaux');
    }

    const { error } = await this.supabase.adminClient
      .from('reservations')
      .delete()
      .eq('id', reservationId);

    if (error) throw new Error(`Impossible de débloquer: ${error.message}`);

    // Invalidate slot cache so the freed slot becomes available again
    await this.invalidateSlotsCache(reservation.salon_id, null, reservation.appointment_date, userId);

    return { success: true, message: 'Créneau débloqué avec succès' };
  }
  /**
   * Get all reservations for the authenticated client.
   */
  async findByClient(clientId: string, limit: number = 50, offset: number = 0) {
    // ── Auto-expire stale reservations via PostgreSQL function ────────────────
    // Using a DB-side function avoids 4 sequential UPDATE calls per request.
    // Falls back silently if the function doesn't exist yet (pre-migration).
    try {
      await this.supabase.adminClient.rpc('expire_client_reservations', {
        p_client_id: clientId,
      });
    } catch {
      // Migration not yet applied — silently continue
    }

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
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch reservations: ${error.message}`);
    return data;
  }

  /**
   * Get all reservations for a salon (barber/owner view).
   */
  async findBySalon(salonId: string, userId: string, date?: string, limit: number = 50, offset: number = 0) {
    // Verify the user owns the salon or is staff
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException('Salon not found');

    const isOwner = salon.owner_id === userId;

    if (!isOwner) {
      // Check if user is salon staff — maybeSingle() avoids 500 when not found
      const { data: staff } = await this.supabase.adminClient
        .from('salon_staff')
        .select('id')
        .eq('salon_id', salonId)
        .eq('profile_id', userId)
        .maybeSingle();

      if (!staff) {
        throw new ForbiddenException('You are not authorized to view this salon\'s reservations');
      }
    }

    // ── Auto-expire stale reservations via PostgreSQL function ────────────────
    // Using a DB-side function avoids 4-6 sequential UPDATE calls per request.
    // Falls back silently if the function doesn't exist yet (pre-migration).
    try {
      await this.supabase.adminClient.rpc('expire_salon_reservations', {
        p_salon_id: salonId,
      });
    } catch {
      // Migration not yet applied — silently continue
    }
    // ─────────────────────────────────────────────────────────────────────────

    let query = this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        profiles!reservations_client_id_fkey(id, full_name, phone_number, avatar_url, loyalty_points),
        services(service_name, price, duration_minutes),
        salon_staff:staff_id(custom_name, profiles!profile_id(full_name))
      `)
      .eq('salon_id', salonId)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (date) {
      query = query.eq('appointment_date', date);
    }

    // Apply pagination when no specific date filter is used
    if (!date) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch salon reservations: ${error.message}`);
    return data;
  }

  /**
   * Get all PENDING reservations for a salon across all dates (barber/owner view).
   * Used to show the "pending approval" list on the calendar screen.
   */
  async findPendingBySalon(salonId: string, userId: string, limit: number = 50, offset: number = 0) {
    // Verify the user owns the salon or is staff
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException('Salon not found');

    const isOwner = salon.owner_id === userId;

    if (!isOwner) {
      const { data: staff } = await this.supabase.adminClient
        .from('salon_staff')
        .select('id')
        .eq('salon_id', salonId)
        .eq('profile_id', userId)
        .maybeSingle();  // maybeSingle avoids 500 when user is not in salon_staff

      if (!staff) {
        throw new ForbiddenException('You are not authorized to view this salon\'s reservations');
      }
    }

    const today = new Date();
    const utc = today.getTime() + today.getTimezoneOffset() * 60000;
    const algeriaTime = new Date(utc + 3600000);
    const todayStr = `${algeriaTime.getFullYear()}-${String(algeriaTime.getMonth() + 1).padStart(2, '0')}-${String(algeriaTime.getDate()).padStart(2, '0')}`;

    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        profiles!reservations_client_id_fkey(full_name, phone_number, avatar_url),
        services(service_name, price, duration_minutes),
        salon_staff:staff_id(custom_name, profiles!profile_id(full_name))
      `)
      .eq('salon_id', salonId)
      .eq('status', 'Pending')
      .gte('appointment_date', todayStr)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch pending reservations: ${error.message}`);
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
    // Fetch existing reservation and check staff membership in parallel
    const [reservationResult, staffResult] = await Promise.all([
      this.supabase.adminClient
        .from('reservations')
        .select('*, salons(owner_id)')
        .eq('id', reservationId)
        .single(),
      this.supabase.adminClient
        .from('salon_staff')
        .select('id, salon_id')
        .eq('profile_id', userId),
    ]);

    const reservation = reservationResult.data;
    if (reservationResult.error || !reservation) {
      throw new NotFoundException('Reservation not found');
    }

    // Verify authorization
    const isClient = reservation.client_id === userId;
    const isBarber = (reservation as unknown as { salons?: { owner_id: string } }).salons?.owner_id === userId;
    const isStaff = !!staffResult.data?.some(s => s.salon_id === reservation.salon_id);

    if (!isClient && !isBarber && !isStaff) {
      throw new ForbiddenException('You are not authorized to update this reservation');
    }

    // Clients can only cancel their own pending reservations
    // Clients can only cancel their own pending or confirmed reservations
    if (isClient && !isBarber && !isStaff) {
      if (dto.status !== 'Cancelled') {
        throw new ForbiddenException('Clients can only cancel reservations');
      }
      if (reservation.status !== 'Pending' && reservation.status !== 'Confirmed') {
        throw new BadRequestException(
          'Only pending or confirmed reservations can be cancelled by clients',
        );
      }
    }

    const updateData: Record<string, unknown> = { status: dto.status };

    if (dto.status === 'Cancelled') {
      updateData.cancelled_by = userId;
      updateData.cancel_reason = dto.cancel_reason ?? null;
    } else {
      updateData.cancelled_by = null;
      updateData.cancel_reason = null;
    }

    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update reservation: ${error.message}`);

    // Invalidate slot cache since reservation status changed (e.g. cancelled)
    await this.invalidateSlotsCache(
      reservation.salon_id,
      reservation.service_id,
      reservation.appointment_date,
      reservation.barber_id,
    );

    // Push notification on status change (fire-and-forget)
    try {
      const statusMessages: Record<string, { title: string; body: string }> = {
        Confirmed: {
          title: '✅ Réservation confirmée',
          body: `Votre rendez-vous du ${reservation.appointment_date} à ${reservation.start_time} a été confirmé.`,
        },
        Cancelled: {
          title: '❌ Réservation annulée',
          body: `Votre rendez-vous du ${reservation.appointment_date} à ${reservation.start_time} a été annulé.`,
        },
        Completed: {
          title: '✔️ Rendez-vous terminé',
          body: `Votre rendez-vous est terminé. Merci d'avoir utilisé 7afefli !`,
        },
      };

      const msg = statusMessages[dto.status];
      if (msg) {
        const salonOwnerId = (reservation as any).salons?.owner_id as string | undefined;
        // Notify client if barber changed status
        if (!isClient && reservation.client_id) {
          this.notificationsService.createNotification(
            reservation.client_id, dto.status.toLowerCase(), msg.title, msg.body,
            { reservationId: reservationId },
          ).catch(() => {});
        }
        // Notify barber if client cancelled
        if (isClient && dto.status === 'Cancelled' && salonOwnerId) {
          this.notificationsService.createNotification(
            salonOwnerId, 'booking_cancelled',
            '⚠️ Réservation annulée',
            `Un client a annulé son rendez-vous du ${reservation.appointment_date} à ${reservation.start_time}.`,
            { reservationId: reservationId },
          ).catch(() => {});
        }
      }
    } catch { /* ignore notification failures */ }

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
          .maybeSingle(); // fix: was .single() — throws PGRST116 (→ 500) when not a staff member
        isStaff = !!staff;
      }

      if (!isClient && !isBarber && !isOwner && !isStaff) {
        throw new ForbiddenException('You are not authorized to view this reservation');
      }
    }

    return data;
  }

  /**
   * Helper to invalidate all potential slot caches for a salon, service, and date.
   */
  private async invalidateSlotsCache(
    salonId: string,
    serviceId: string | null,
    appointmentDate: string,
    barberId?: string | null,
  ): Promise<void> {
    try {
      // 1. Resolve staff information once outside the loop
      let resolvedStaff: { id: string; profile_id: string | null } | null = null;
      let staffList: { id: string; profile_id: string | null }[] | null = null;

      if (barberId) {
        const { data: staff } = await this.supabase.adminClient
          .from('salon_staff')
          .select('id, profile_id')
          .or(`id.eq.${barberId},profile_id.eq.${barberId}`)
          .maybeSingle();
        resolvedStaff = staff;
      } else {
        const { data: list } = await this.supabase.adminClient
          .from('salon_staff')
          .select('id, profile_id')
          .eq('salon_id', salonId);
        staffList = list;
      }

      // 2. Fetch service IDs if not specified
      const servicesToInvalidate: string[] = [];
      if (serviceId) {
        servicesToInvalidate.push(serviceId);
      } else {
        const { data: services } = await this.supabase.adminClient
          .from('services')
          .select('id')
          .eq('salon_id', salonId);
        if (services) {
          services.forEach(s => servicesToInvalidate.push(s.id));
        }
      }

      // 3. Collect and run all deletion promises in parallel
      const deletePromises: Promise<unknown>[] = [];
      for (const sId of servicesToInvalidate) {
        const cachePattern = `slots_v2:${salonId}:${sId}:${appointmentDate}`;

        // Always clear the "any barber" cache entry
        deletePromises.push(this.cacheManager.del(`${cachePattern}:any`));

        if (barberId) {
          // Clear the specific barberId cache entry
          deletePromises.push(this.cacheManager.del(`${cachePattern}:${barberId}`));
          if (resolvedStaff) {
            // Clear by salon_staff.id
            deletePromises.push(this.cacheManager.del(`${cachePattern}:${resolvedStaff.id}`));
            // Clear by profile_id (the other key format used when booking)
            if (resolvedStaff.profile_id) {
              deletePromises.push(this.cacheManager.del(`${cachePattern}:${resolvedStaff.profile_id}`));
            }
          }
        } else if (staffList) {
          // No specific barber — clear cache for ALL barbers in the salon
          for (const staff of staffList) {
            deletePromises.push(this.cacheManager.del(`${cachePattern}:${staff.id}`));
            if (staff.profile_id) {
              deletePromises.push(this.cacheManager.del(`${cachePattern}:${staff.profile_id}`));
            }
          }
        }
      }

      await Promise.all(deletePromises);
    } catch (err: unknown) {
      this.logger.warn(`Slot cache invalidation failed (non-fatal): ${(err as Error).message ?? err}`);
    }
  }

  /**
   * Get pre-aggregated clients for a salon to replace frontend calculation.
   * Processes all non-cancelled reservations to find unique clients.
   */
  async getSalonClients(salonId: string, userId: string) {
    // Verify the user owns the salon or is staff
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException('Salon not found');

    const isOwner = salon.owner_id === userId;
    if (!isOwner) {
      const { data: staff } = await this.supabase.adminClient
        .from('salon_staff')
        .select('id')
        .eq('salon_id', salonId)
        .eq('profile_id', userId)
        .maybeSingle();

      if (!staff) {
        throw new ForbiddenException('You are not authorized to view this salon\'s clients');
      }
    }

    // Fetch all non-cancelled real reservations (ignoring blocks)
    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        id,
        client_id, 
        is_walk_in, 
        notes, 
        client_phone,
        appointment_date,
        start_time,
        status,
        services(price),
        profiles!reservations_client_id_fkey(id, full_name, phone_number, avatar_url, loyalty_points)
      `)
      .eq('salon_id', salonId)
      .not('status', 'eq', 'Cancelled')
      .or('notes.is.null,notes.not.ilike.%CRÉNEAU BLOQUÉ%')
      .limit(500); // fix M6: prevent unbounded queries on active salons

    if (error) throw new Error(`Failed to fetch clients: ${error.message}`);

    const appMembersMap = new Map<string, any>();
    const walkInMap = new Map<string, any>();

    let totalAppMembers = 0;
    let totalWalkIns = 0;
    let returningClients = 0;
    let newClients = 0;

    for (const res of (data || [])) {
      const servicesObj = res.services as any;
      const price = servicesObj?.price || 0;
      const appt = {
        id: res.id,
        date: res.appointment_date,
        time: res.start_time,
        status: res.status,
        price,
      };

      if (res.is_walk_in) {
        const walkInKey = res.notes || `walkin-${res.client_id}-${res.id}`;
        if (!walkInMap.has(walkInKey)) {
          walkInMap.set(walkInKey, {
            id: walkInKey,
            full_name: res.notes ? res.notes.replace('[Sans RDV] Client: ', '').replace('[Sans RDV]', '').trim() : 'Client sans RDV',
            phone_number: res.client_phone || null,
            is_walk_in: true,
            reservation_count: 1,
            totalSpent: price,
            lastVisitDate: res.appointment_date,
            appointments: [appt],
          });
          totalWalkIns++;
        } else {
          const client = walkInMap.get(walkInKey);
          client.reservation_count++;
          client.totalSpent += price;
          client.appointments.push(appt);
          if (new Date(res.appointment_date) > new Date(client.lastVisitDate)) {
            client.lastVisitDate = res.appointment_date;
          }
        }
      } else {
        const p = Array.isArray(res.profiles) ? res.profiles[0] : res.profiles;
        if (p && p.id) {
          if (!appMembersMap.has(p.id)) {
            appMembersMap.set(p.id, {
              ...p,
              is_walk_in: false,
              reservation_count: 1,
              totalSpent: price,
              lastVisitDate: res.appointment_date,
              appointments: [appt],
            });
            totalAppMembers++;
          } else {
            const client = appMembersMap.get(p.id);
            client.reservation_count++;
            client.totalSpent += price;
            client.appointments.push(appt);
            if (new Date(res.appointment_date) > new Date(client.lastVisitDate)) {
              client.lastVisitDate = res.appointment_date;
            }
          }
        }
      }
    }

    const appMembers = Array.from(appMembersMap.values());
    const walkInClients = Array.from(walkInMap.values());

    // Calculate returning vs new based on combined unique clients
    const allClients = [...appMembers, ...walkInClients];
    for (const c of allClients) {
      if (c.reservation_count > 1) {
        returningClients++;
      } else {
        newClients++;
      }
    }

    return {
      appMembers,
      walkInClients,
      statistics: {
        totalClients: totalAppMembers + totalWalkIns,
        totalAppMembers,
        totalWalkIns,
        returningClients,
        newClients
      }
    };
  }

}
