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
  Delete,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SalonsService } from './salons.service';
import { SalonServicesService } from '../salon-services/salon-services.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.guard';

@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
    private readonly salonServicesService: SalonServicesService,
  ) {}

  /**
   * GET /salons
   * List approved salons with optional filtering.
   * Uses the generous 'explore' throttle (600 req/min) to support the map view.
   */
  @Get()
  @Throttle({ explore: { ttl: 60000, limit: 600 } })
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
   * Uses the generous 'explore' throttle (600 req/min).
   */
  @Get('nearby')
  @Throttle({ explore: { ttl: 60000, limit: 600 } })
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salonsService.findNearby(lat, lng, radius, limit);
  }

  /**
   * GET /salons/my-salon
   * Get salon for the authenticated owner
   */
  @Get('my-salon')
  @UseGuards(SupabaseAuthGuard)
  findMySalon(@CurrentUser() user: AuthenticatedUser) {
    return this.salonsService.findByOwner(user.id);
  }

  /**
   * GET /salons/my-salon/stats
   * Get dashboard statistics for the authenticated owner's salon.
   */
  @Get('my-salon/stats')
  @UseGuards(SupabaseAuthGuard)
  getDashboardStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period: 'day' | 'month' | 'all' = 'day',
    @Query('date') date?: string,
  ) {
    return this.salonsService.getDashboardStats(user.id, period, date);
  }

  /**
   * GET /salons/favorites
   * List all favorited salons for the authenticated user.
   * IMPORTANT: Must be defined BEFORE :id routes to avoid 'favorites' being captured as :id.
   */
  @Get('favorites')
  @UseGuards(SupabaseAuthGuard)
  getFavorites(@CurrentUser() user: AuthenticatedUser) {
    return this.salonsService.getFavorites(user.id);
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
   * Update salon details (Coiffeur owner only).
   */
  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSalonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.update(id, dto, user.id);
  }

  /**
   * DELETE /salons/:id
   * Delete a salon (Coiffeur owner only).
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.remove(id, user.id);
  }

  /**
   * POST /salons/:id/staff
   * Add a staff member
   */
  @Post(':id/staff')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  addStaff(
    @Param('id') id: string,
    @Body() dto: { customName: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.addStaff(id, dto.customName, user.id);
  }

  @Get(':id/staff')
  getStaff(@Param('id') id: string) {
    return this.salonsService.getStaff(id);
  }

  @Delete(':id/staff/:staffId')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  removeStaff(
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.removeStaff(id, staffId, user.id);
  }

  @Patch(':id/staff/:staffId/avatar')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  updateStaffAvatar(
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @Body('avatarUrl') avatarUrl: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.updateStaffAvatar(id, staffId, avatarUrl, user.id);
  }

  /**
   * POST /salons/:id/staff/:staffId/avatar/upload-url
   * Generate a Supabase signed upload URL for a staff member avatar.
   * The mobile client uploads directly via PUT to bypass ArrayBuffer/Hermes bug.
   */
  @Post(':id/staff/:staffId/avatar/upload-url')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  getStaffAvatarUploadUrl(
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.getStaffAvatarUploadUrl(id, staffId, user.id);
  }

  @Get(':id/portfolio')
  getPortfolio(@Param('id') id: string) {
    return this.salonsService.getPortfolio(id);
  }

  @Post(':id/portfolio')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  addPortfolioPhoto(
    @Param('id') id: string,
    @Body('storagePath') storagePath: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.addPortfolioPhoto(id, storagePath, user.id);
  }

  /**
   * POST /salons/:id/portfolio/upload-url
   * Generate a Supabase signed upload URL after checking the plan quota.
   * The client uploads directly to Supabase Storage using this URL.
   * Coiffeur only — must own the salon.
   */
  @Post(':id/portfolio/upload-url')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  getPortfolioUploadUrl(
    @Param('id') id: string,
    @Body('fileName') fileName: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.getPortfolioUploadUrl(id, fileName, user.id);
  }

  /**
   * POST /salons/:id/cover/upload-url
   * Generate a Supabase signed upload URL for the salon cover photo.
   * Uses service role key → bypasses RLS completely.
   * Coiffeur only — must own the salon.
   */
  @Post(':id/cover/upload-url')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  getCoverUploadUrl(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.getCoverUploadUrl(id, user.id);
  }


  @Delete(':id/portfolio/:photoId')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  removePortfolioPhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.removePortfolioPhoto(id, photoId, user.id);
  }

  /**
   * GET /salons/:id/reviews
   * Get all reviews for a salon (public).
   */
  @Get(':id/reviews')
  getReviews(@Param('id') id: string) {
    return this.salonsService.getReviews(id);
  }

  /**
   * GET /salons/:id/services
   * Alias for GET /salon-services/:salonId — matches mobile client expectation.
   * Returns all active services for a salon (public).
   */
  @Get(':id/services')
  getSalonServices(@Param('id') id: string) {
    return this.salonServicesService.findBySalon(id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Favorites (M3)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /salons/:id/favorited
   * Check if a specific salon is favorited by the authenticated user.
   */
  @Get(':id/favorited')
  @UseGuards(SupabaseAuthGuard)
  checkFavorited(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.isFavorited(user.id, id);
  }

  /**
   * POST /salons/:id/favorite
   * Add a salon to favorites (authenticated clients).
   */
  @Post(':id/favorite')
  @UseGuards(SupabaseAuthGuard)
  addFavorite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.addFavorite(user.id, id);
  }

  /**
   * DELETE /salons/:id/favorite
   * Remove a salon from favorites.
   */
  @Delete(':id/favorite')
  @UseGuards(SupabaseAuthGuard)
  removeFavorite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salonsService.removeFavorite(user.id, id);
  }
}
