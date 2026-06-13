// services/api/src/reservations/reservations.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { BlockTimeDto } from './dto/block-time.dto';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.guard';

@Controller('reservations')
@UseGuards(SupabaseAuthGuard)
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /reservations
   * Create a new reservation (Client only).
   * Throttled to 5 requests/minute per IP to prevent double-submit spam and
   * advisory-lock pool exhaustion.
   */
  @Post()
  @Throttle({ booking: { ttl: 60000, limit: 5 } })
  @UseGuards(RolesGuard)
  @Roles('Client', 'Coiffeur')
  create(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.create(dto, user.id);
  }

  /**
   * POST /reservations/block
   * Block a time slot (Coiffeur only).
   */
  @Post('block')
  @UseGuards(RolesGuard)
  @Roles('Coiffeur')
  blockTime(
    @Body() dto: BlockTimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.blockTime(
      dto.salonId,
      user.id,
      dto.date,
      dto.startTime,
      dto.endTime,
    );
  }

  /**
   * DELETE /reservations/block/:id
   * Unblock a time slot (Coiffeur only — can only delete own blocks).
   */
  @Delete('block/:id')
  @UseGuards(RolesGuard)
  @Roles('Coiffeur')
  unblockTime(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.unblockTime(id, user.id);
  }

  /**
   * GET /reservations/me
   * Get authenticated client's own reservations.
   */
  @Get('me')
  findMyReservations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.reservationsService.findByClient(
      user.id,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  /**
   * GET /reservations/salon/:salonId/pending
   * Get all PENDING reservations for a salon across ALL dates.
   */
  @Get('salon/:salonId/pending')
  @UseGuards(RolesGuard)
  @Roles('Coiffeur', 'Admin')
  findPendingBySalon(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.reservationsService.findPendingBySalon(
      salonId,
      user.id,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  /**
   * GET /reservations/salon/:salonId
   * Get all reservations for a salon (barber/owner view).
   */
  @Get('salon/:salonId')
  @UseGuards(RolesGuard)
  @Roles('Coiffeur', 'Admin')
  findBySalon(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.reservationsService.findBySalon(
      salonId,
      user.id,
      date,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  /**
   * GET /reservations/salon/:salonId/clients
   * Get all aggregated unique clients (members and walk-ins) for a salon.
   */
  @Get('salon/:salonId/clients')
  @UseGuards(RolesGuard)
  @Roles('Coiffeur', 'Admin')
  getSalonClients(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.getSalonClients(salonId, user.id);
  }

  /**
   * PATCH /reservations/:id/status
   * Update reservation status (confirm, cancel, complete).
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('Client', 'Coiffeur', 'Admin')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.updateStatus(id, dto, user.id);
  }

  /**
   * GET /reservations/cron/reminders
   * Vercel Cron Job endpoint — fires hourly to send booking reminders.
   * NOT protected by SupabaseAuthGuard (cron has no user JWT).
   * Protected by the CRON_SECRET header that Vercel sends automatically.
   *
   * On Vercel, @nestjs/schedule @Cron() decorators never fire because
   * serverless functions terminate after each request. This HTTP endpoint
   * is the production-safe replacement, triggered by Vercel's built-in
   * cron scheduler (configured in vercel.json).
   *
   * Set CRON_SECRET in Vercel environment variables to secure this endpoint.
   */
  @Get('cron/reminders')
  @HttpCode(HttpStatus.OK)
  async cronSendReminders(
    @Headers('authorization') authHeader?: string,
  ) {
    const cronSecret = this.configService.get<string>('CRON_SECRET');
    // If CRON_SECRET is configured, validate the Bearer token
    if (cronSecret) {
      const token = authHeader?.replace('Bearer ', '');
      if (token !== cronSecret) {
        throw new UnauthorizedException('Invalid cron secret');
      }
    }
    await this.reservationsService.sendBookingReminders();
    return { ok: true, message: 'Booking reminders dispatched' };
  }

  /**
   * GET /reservations/:id
   * Get a single reservation — only visible to the client, salon owner,
   * assigned staff member, or an Admin.
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.findOne(id, user);
  }
}
