// services/api/src/admin/admin.controller.ts

import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Delete,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateAdminSalonDto } from './dto/update-admin-salon.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('Admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /admin/salons/pending
   * List salons awaiting approval.
   */
  @Get('salons/pending')
  getPendingSalons() {
    return this.adminService.getPendingSalons();
  }

  /**
   * PATCH /admin/salons/:id/approve
   * Approve or reject a salon.
   * Body: { "approved": true }
   */
  @Patch('salons/:id/approve')
  approveSalon(
    @Param('id') id: string,
    @Body('approved', ParseBoolPipe) approved: boolean,
  ) {
    return this.adminService.approveSalon(id, approved);
  }

  @Get('salons')
  getAllSalons(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAllSalons(page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Delete('salons/:id')
  deleteSalon(@Param('id') id: string) {
    return this.adminService.deleteSalon(id);
  }

  @Get('users')
  getAllUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAllUsers(page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Patch('users/:id/ban')
  banUser(
    @Param('id') id: string,
    @Body('isBanned', ParseBoolPipe) isBanned: boolean,
  ) {
    return this.adminService.banUser(id, isBanned);
  }

  @Patch('users/:id/role')
  changeUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.changeUserRole(id, dto.role);
  }

  /**
   * GET /admin/stats
   * Get platform-wide statistics.
   */
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('audit')
  getAuditLogs() {
    return this.adminService.getAuditLogs();
  }

  @Get('audit/export')
  exportAuditLogsCsv() {
    return this.adminService.exportAuditLogsCsv();
  }

  @Get('revenue')
  getRevenueStats() {
    return this.adminService.getRevenueStats();
  }

  /**
   * GET /admin/analytics
   * MEDIUM-5: Aggregated revenue, subscription breakdown, and top salons.
   */
  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('reservations')
  getAllReservations(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAllReservations(page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Delete('reservations/:id')
  deleteReservation(@Param('id') id: string) {
    return this.adminService.deleteReservation(id);
  }

  @Get('subscriptions')
  getAllSubscriptions() {
    return this.adminService.getAllSubscriptions();
  }

  /**
   * POST /admin/salons/:id/sponsor
   * Sponsor a salon for a given number of days (Admin only).
   * Body: { "days": 30 }
   */
  @Post('salons/:id/sponsor')
  sponsorSalon(
    @Param('id') id: string,
    @Body('days', ParseIntPipe) days: number,
  ) {
    return this.adminService.sponsorSalon(id, days ?? 30);
  }

  /**
   * DELETE /admin/salons/:id/sponsor
   * Remove sponsoring from a salon (Admin only).
   */
  @Delete('salons/:id/sponsor')
  unsponsorSalon(@Param('id') id: string) {
    return this.adminService.unsponsorSalon(id);
  }

  /**
   * PATCH /admin/salons/:id
   * Update salon fields such as is_sponsored (Admin only).
   */
  @Patch('salons/:id')
  updateSalon(
    @Param('id') id: string,
    @Body() dto: UpdateAdminSalonDto,
  ) {
    return this.adminService.updateSalon(id, dto);
  }

  /**
   * GET /admin/payments
   * Get paginated payment records with joined salon data (Admin only).
   */
  @Get('payments')
  getPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getPayments(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  /**
   * GET /admin/reviews
   * Get all reviews for moderation (Admin only).
   */
  @Get('reviews')
  getAllReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllReviews(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  /**
   * DELETE /admin/reviews/:id
   * Delete a review (Admin only).
   */
  @Delete('reviews/:id')
  deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }

  /**
   * PATCH /admin/plans/:id
   * Update a subscription plan's name, price, limits (Admin only).
   */
  @Patch('plans/:id')
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.adminService.updatePlan(id, dto);
  }

  /**
   * POST /admin/notifications/broadcast
   * Broadcast a notification to all users.
   */
  @Post('notifications/broadcast')
  broadcastNotification(
    @Body() dto: BroadcastNotificationDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.broadcastNotification(dto, adminId);
  }

  /**
   * GET /admin/notifications/broadcasts
   * Get past broadcast notification logs.
   */
  @Get('notifications/broadcasts')
  getBroadcasts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getBroadcasts(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }
}
