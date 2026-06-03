// services/api/src/admin/admin.controller.ts

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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
    @Body('role') role: string,
  ) {
    return this.adminService.changeUserRole(id, role);
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
}
