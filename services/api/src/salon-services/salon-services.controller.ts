// services/api/src/salon-services/salon-services.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SalonServicesService } from './salon-services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.guard';

@Controller('salons/:salonId/services')
export class SalonServicesController {
  constructor(private readonly salonServicesService: SalonServicesService) {}

  /**
   * GET /salons/:salonId/services
   * List services for a salon (public).
   */
  @Get()
  findBySalon(@Param('salonId') salonId: string) {
    return this.salonServicesService.findBySalon(salonId);
  }

  /**
   * POST /salons/:salonId/services
   * Add a service to a salon (Coiffeur only, owner verified in service).
   */
  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  create(
    @Param('salonId') salonId: string,
    @Body() dto: CreateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonServicesService.create(salonId, dto, user.id);
  }

  /**
   * PATCH /salons/:salonId/services/:id
   * Update a service (Coiffeur only, owner verified in service).
   */
  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonServicesService.update(salonId, id, dto, user.id);
  }

  /**
   * DELETE /salons/:salonId/services/:serviceId
   * Remove a service (hard delete, Coiffeur only).
   */
  @Delete(':serviceId')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  removeService(
    @Param('salonId') salonId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonServicesService.deactivate(salonId, serviceId, user.id);
  }
}
