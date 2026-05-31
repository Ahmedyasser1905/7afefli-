// services/api/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
