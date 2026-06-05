// services/api/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

import { AuthController } from './auth.controller';
import { PasswordController } from './password.controller';
import { PasswordService } from './password.service';

@Module({
  controllers: [AuthController, PasswordController],
  providers: [SupabaseAuthGuard, RolesGuard, PasswordService],
  exports: [SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
