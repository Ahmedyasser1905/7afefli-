// services/api/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
