// services/api/src/salons/salons.controller.ts

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
import { SalonsService } from './salons.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.guard';

@Controller('salons')
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  /**
   * GET /salons
   * List approved salons with optional filtering.
   */
  @Get()
  findAll(
    @Query('wilaya') wilaya?: string,
    @Query('search') search?: string,
    @Query('sponsored') sponsored?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.salonsService.findAll({ wilaya, search, sponsored, limit, offset });
  }

  /**
   * GET /salons/nearby?lat=36.75&lng=3.06&radius=10
   * Find salons within a geographic radius.
   */
  @Get('nearby')
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salonsService.findNearby(lat, lng, radius, limit);
  }

  /**
   * GET /salons/:id
   * Get full salon details with services, staff, portfolio.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salonsService.findOne(id);
  }

  /**
   * POST /salons
   * Create a new salon (Coiffeur only).
   */
  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  create(
    @Body() dto: CreateSalonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.create(dto, user.id);
  }

  /**
   * PATCH /salons/:id
   * Update salon details (owner only).
   */
  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSalonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.update(id, dto, user.id);
  }
}
