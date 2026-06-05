// services/api/src/auth/auth.controller.ts
// SECURITY: All mutating endpoints are protected by SupabaseAuthGuard.
// The /auth/verify endpoint uses the authenticated user's id from the JWT —
// never from the request body — to prevent impersonation and privilege escalation.

import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Body,
  UseGuards,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthGuard, AuthenticatedUser } from './auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { VerifyProfileDto } from './dto/verify-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * POST /auth/verify
   * Creates or updates the authenticated user's profile record.
   *
   * SECURITY:
   * - Requires a valid Supabase JWT (SupabaseAuthGuard).
   * - Uses user.id from the verified JWT — dto.id is ignored entirely.
   * - role field is NOT accepted from the client body; role assignment
   *   is exclusively an admin operation.
   */
  @Post('verify')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and upsert the authenticated user profile' })
  async verifyProfile(
    @Body() dto: VerifyProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Always use the JWT user id — never trust client-provided id
    const upsertData: Record<string, unknown> = {
      id: user.id,
      phone_number: dto.phoneNumber,
      is_phone_verified: true,
      updated_at: new Date().toISOString(),
    };

    if (dto.fullName) upsertData.full_name = dto.fullName;
    // role is intentionally NOT set here — use admin endpoints only

    const { data, error } = await this.supabase.adminClient
      .from('profiles')
      .upsert(upsertData)
      .select('id, phone_number, full_name, role, is_phone_verified, created_at, updated_at')
      .single();

    if (error) {
      this.logger.error(`Profile verification failed for user ${user.id}: ${error.message}`);
      throw new InternalServerErrorException(`Verification failed: ${error.message}`);
    }

    this.logger.log(`Profile verified for user ${user.id}`);
    return data;
  }

  @Get('profiles/me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const { data, error } = await this.supabase.adminClient
      .from('profiles')
      .select('id, phone_number, full_name, role, avatar_url, wilaya, is_phone_verified, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Profile fetch failed for user ${user.id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch profile');
    }

    // Profile row may not exist yet (new sign-up) — return a safe default
    if (!data) {
      return {
        id: user.id,
        phone_number: user.phone ?? null,
        full_name: null,
        role: 'Client',
        avatar_url: null,
        wilaya: null,
        is_phone_verified: false,
        created_at: null,
        updated_at: null,
      };
    }

    return data;
  }

  @Patch('profiles/me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    // Explicitly whitelist allowed update fields — role cannot be updated here
    const allowedUpdate: Record<string, unknown> = {};
    if (dto.full_name !== undefined) allowedUpdate.full_name = dto.full_name;
    if (dto.phone_number !== undefined) allowedUpdate.phone_number = dto.phone_number;
    if (dto.avatar_url !== undefined) allowedUpdate.avatar_url = dto.avatar_url;
    if (dto.wilaya !== undefined) allowedUpdate.wilaya = dto.wilaya;
    allowedUpdate.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase.adminClient
      .from('profiles')
      .update(allowedUpdate)
      .eq('id', user.id)
      .select('id, phone_number, full_name, role, avatar_url, wilaya, is_phone_verified, updated_at')
      .maybeSingle();

    if (error) {
      this.logger.error(`Profile update failed for user ${user.id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update profile');
    }
    if (!data) throw new NotFoundException('Profile not found');
    return data;
  }

  @Delete('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete the authenticated user account' })
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    // 1. If user is barber, check for active reservations
    if (user.role === 'Coiffeur') {
      const { data: salons } = await this.supabase.adminClient
        .from('salons')
        .select('id')
        .eq('owner_id', user.id);

      if (salons && salons.length > 0) {
        const salonIds = salons.map((s) => s.id);
        const { count } = await this.supabase.adminClient
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .in('salon_id', salonIds)
          .in('status', ['Pending', 'Confirmed']);

        if (count && count > 0) {
          throw new ConflictException(
            'Impossible de supprimer le compte: Vous avez des réservations actives.',
          );
        }
      }
    }

    // 2. Delete user from auth.users (this triggers cascade deletes on profiles)
    const { error } = await this.supabase.adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      this.logger.error(`Account deletion failed for user ${user.id}: ${error.message}`);
      throw new InternalServerErrorException(`Account deletion failed: ${error.message}`);
    }

    this.logger.log(`Account deleted for user ${user.id}`);
    return { success: true };
  }

  /**
   * POST /auth/reset-password
   * Send a password reset email (public — no auth required).
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset email' })
  async resetPassword(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const { error } = await this.supabase.adminClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${process.env.APP_URL || 'https://7afefli.app'}/reset-password`,
      },
    );

    if (error) {
      this.logger.error(`Password reset failed for ${email}: ${error.message}`);
      // Don't reveal whether the email exists
    }

    return { message: 'Email de réinitialisation envoyé' };
  }

  /**
   * POST /auth/update-password
   * Update the authenticated user's password.
   */
  @Post('update-password')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the authenticated user password' })
  async updatePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body('password') password: string,
  ) {
    if (!password || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const { error } = await this.supabase.adminClient.auth.admin.updateUserById(
      user.id,
      { password },
    );

    if (error) {
      this.logger.error(`Password update failed for user ${user.id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update password');
    }

    this.logger.log(`Password updated for user ${user.id}`);
    return { message: 'Mot de passe mis à jour' };
  }

  /**
   * POST /auth/resend-verification
   * Resend the email verification link (public — no auth required).
   */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      await this.supabase.adminClient.auth.resend({
        type: 'signup',
        email,
      });
    } catch {
      // Don't reveal whether the email exists
    }

    return { message: 'Email de vérification envoyé' };
  }
}
