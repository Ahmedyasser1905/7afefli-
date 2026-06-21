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
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { AuditModule } from './audit/audit.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AppController } from './app.controller';
import { LocationsModule } from './locations/locations.module';
import { NotificationsModule } from './notifications/notifications.module';

// NOTE: redis packages are require()'d lazily inside the factories below.
// Top-level static imports of cache-manager-ioredis and
// nestjs-throttler-storage-redis cause ioredis to open connections
// immediately at module load time — even when REDIS_URL is not set.

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    AuthModule,
    ScheduleModule.forRoot(),

    // ── Cache ────────────────────────────────────────────────────────────────
    // When REDIS_URL is set  → uses ioredis-backed cache-manager store
    // When REDIS_URL is absent → falls back to in-memory store (no Redis needed)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (url) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const redisStore = require('cache-manager-ioredis');
          return { store: redisStore, url, ttl: 60 * 1000 } as unknown as Record<string, unknown>;
        }
        return { ttl: 60 * 1000 } as unknown as Record<string, unknown>;
      },
    }),

    // ── Rate limiting ─────────────────────────────────────────────────────────
    // When REDIS_URL is set  → uses Redis-backed throttler (distributed)
    // When REDIS_URL is absent → uses default in-memory throttler
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL;
        const throttlers = [
          // General authenticated usage — 300 req / min is generous for real users
          { name: 'global', ttl: 60 * 1000, limit: 300 },
          // Read-heavy discovery endpoints (GET /salons, nearby, etc.) — very high limit
          { name: 'explore', ttl: 60 * 1000, limit: 600 },
          // Tight limit on booking creation to prevent spam / advisory-lock exhaustion
          { name: 'booking', ttl: 60 * 1000, limit: 5 },
        ];
        if (url) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { ThrottlerStorageRedisService } = require('nestjs-throttler-storage-redis');
          return {
            throttlers,
            storage: new ThrottlerStorageRedisService(url),
          };
        }
        return { throttlers };
      },
    }),

    SalonsModule,
    SalonServicesModule,
    SlotsModule,
    ReservationsModule,
    ReviewsModule,
    AdminModule,
    AuditModule,
    PaymentsModule,
    SubscriptionsModule,
    LocationsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
