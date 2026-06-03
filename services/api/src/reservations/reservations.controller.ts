// services/api/src/reservations/reservations.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  constructor(private readonly reservationsService: ReservationsService) {}

  /**
   * POST /reservations
   * Create a new reservation (Client only).
   */
  @Post()
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
   * GET /reservations/me
   * Get authenticated client's own reservations.
   */
  @Get('me')
  findMyReservations(@CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.findByClient(user.id);
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
    @Query('date') date: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.findBySalon(salonId, user.id, date);
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
