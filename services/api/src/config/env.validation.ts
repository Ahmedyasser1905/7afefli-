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
    'APP_URL',  // fix L9: used in auth.controller for password-reset redirect link
    // 'SENTRY_DSN', // Optional monitoring
  ],
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
    const errorMsg = `🚨 Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
      `Copy .env.example to .env and fill in all values before starting.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.log('✅ Environment validation passed');
}
