// services/api/src/admin/admin.controller.ts

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
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

  /**
   * GET /admin/stats
   * Get platform-wide statistics.
   */
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }
}
