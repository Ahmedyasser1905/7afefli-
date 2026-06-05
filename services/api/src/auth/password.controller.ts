import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PasswordService } from './password.service';
import { SendPasswordCodeDto, VerifyPasswordCodeDto, ResetPasswordDto } from './dto/password-reset.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth/password')
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 } }) // Max 5 requests per hour
  @ApiOperation({ summary: 'Envoyer un code OTP de réinitialisation par e-mail' })
  @ApiResponse({ status: 200, description: 'Code envoyé si l\'e-mail existe' })
  async sendCode(@Body() dto: SendPasswordCodeDto) {
    await this.passwordService.sendCode(dto.email);
    return { message: 'Si cette adresse existe, un code OTP à 6 chiffres a été envoyé.' };
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60 * 10 } }) // Max 10 attempts per 10 mins
  @ApiOperation({ summary: 'Vérifier le code OTP' })
  @ApiResponse({ status: 200, description: 'Code valide' })
  @ApiResponse({ status: 400, description: 'Code invalide ou expiré' })
  async verifyCode(@Body() dto: VerifyPasswordCodeDto) {
    await this.passwordService.verifyCode(dto.email, dto.code);
    return { message: 'Code OTP validé avec succès.' };
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe après validation de l\'OTP' })
  @ApiResponse({ status: 200, description: 'Mot de passe mis à jour avec succès' })
  @ApiResponse({ status: 400, description: 'Code non validé ou invalide' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordService.resetPassword(dto.email, dto.code, dto.newPassword);
    return { message: 'Votre mot de passe a été réinitialisé avec succès.' };
  }
}
