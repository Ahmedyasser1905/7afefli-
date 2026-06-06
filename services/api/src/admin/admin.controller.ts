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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

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
    @Body('approved') approved: boolean,
  ) {
    return this.adminService.approveSalon(id, approved);
  }

  @Get('salons')
  getAllSalons() {
    return this.adminService.getAllSalons();
  }

  @Delete('salons/:id')
  deleteSalon(@Param('id') id: string) {
    return this.adminService.deleteSalon(id);
  }

  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
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

  @Get('reservations')
  getAllReservations() {
    return this.adminService.getAllReservations();
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
    @Body('days') days: number,
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
}
