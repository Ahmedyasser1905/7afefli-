// services/api/src/config/env.validation.ts
// Validates required environment variables at application startup.
// The app will fail fast (exit) if any required variable is missing.

import { Logger } from '@nestjs/common';

interface EnvConfig {
  required: string[];
  productionOnly: string[];
}

const ENV_CONFIG: EnvConfig = {
  required: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET',
    'ALLOWED_ORIGINS',
  ],
  productionOnly: [
    'CHARGILY_SECRET_KEY',
    'APP_URL',  // used in auth.controller for password-reset redirect link
    'CHARGILY_WEBHOOK_URL', // Required: Chargily Pay webhook callback URL (Railway deployed URL + /api/v1/payments/webhook)
    'CRON_SECRET', // secures /cron/* endpoints called by Vercel Cron Jobs
    // 'SENTRY_DSN', // Optional monitoring
  ],
  // Optional vars (with sensible defaults):
  // LOYALTY_POINTS_PER_RESERVATION=10  — points awarded per completed reservation
  // REDIS_URL                          — if absent, falls back to in-memory cache
};

export function validateEnvironment(): void {
  const logger = new Logger('EnvValidation');
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];

  // Always-required variables
  for (const key of ENV_CONFIG.required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Production-only required variables
  if (isProduction) {
    for (const key of ENV_CONFIG.productionOnly) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    const coreMissing = missing.filter(k => ENV_CONFIG.required.includes(k));
    const prodMissing = missing.filter(k => ENV_CONFIG.productionOnly.includes(k));

    if (coreMissing.length > 0) {
      const errorMsg = `🚨 Missing CORE environment variables: ${coreMissing.join(', ')}. App cannot start.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (prodMissing.length > 0) {
      logger.warn(`⚠️ Missing optional production environment variables: ${prodMissing.join(', ')}. Some features may not work.`);
    }
  }

  logger.log('✅ Environment validation passed');
}
