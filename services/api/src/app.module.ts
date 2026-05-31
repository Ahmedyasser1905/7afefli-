// services/api/src/app.module.ts
// Root module — imports all feature modules

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { SalonsModule } from './salons/salons.module';
import { SalonServicesModule } from './salon-services/salon-services.module';
import { SlotsModule } from './slots/slots.module';
import { ReservationsModule } from './reservations/reservations.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // Load .env file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Core
    SupabaseModule,
    AuthModule,

    // Features
    SalonsModule,
    SalonServicesModule,
    SlotsModule,
    ReservationsModule,
    ReviewsModule,
    AdminModule,
  ],
})
export class AppModule {}
