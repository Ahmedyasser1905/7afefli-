// services/api/src/notifications/notifications.controller.ts
import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SupabaseAuthGuard, AuthenticatedUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * POST /notifications/push-token
   * Register or refresh the device's Expo push token.
   * The mobile app calls this after login/registration.
   */
  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  async savePushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body('token') token: string,
  ) {
    if (!token) throw new BadRequestException('Push token is required');
    await this.notificationsService.savePushToken(user.id, token);
    return { success: true };
  }

  /**
   * DELETE /notifications/push-token
   * Unregister the device's push token (e.g., when disabling notifications).
   */
  @Delete('push-token')
  @HttpCode(HttpStatus.OK)
  async removePushToken(@CurrentUser() user: AuthenticatedUser) {
    await this.notificationsService.removePushToken(user.id);
    return { success: true };
  }

  @Get()
  getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.notificationsService.getMyNotifications(
      user.id,
      limit ? Number(limit) : 30,
      offset ? Number(offset) : 0,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }
}
