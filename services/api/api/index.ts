// services/api/api/index.ts
// Vercel serverless entry point for NestJS API
// Uses singleton bootstrap pattern to minimize cold starts.
// express is loaded via require() to avoid TypeScript TS2349 type conflicts
// with @types/express v5 in strict compilation environments.

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import type { Request, Response, Application } from 'express';
import { AppModule } from '../src/app.module';
import { validateEnvironment } from '../src/config/env.validation';

// Use require() to bypass TS2349 — express uses `export =` CommonJS syntax
// which is not callable via namespace import in strict TS without esModuleInterop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expressLib = require('express');
const server: Application = expressLib();

let app: any;

async function bootstrap() {
  if (!app) {
    // ── Env validation: fail fast if required variables are missing ────────
    validateEnvironment();

    // ── Create NestJS application using the Express adapter ────────────────
    app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: WinstonModule.createLogger({
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              nestWinstonModuleUtilities.format.nestLike('BarberDZ', {
                colors: true,
                prettyPrint: true,
              }),
            ),
          }),
        ],
      }),
    });

    // ── Graceful shutdown (applicable to serverless container reuse) ────────
    app.enableShutdownHooks();

    // ── Raw body for Chargily webhook ─────────────────────────────────────────
    // MUST come before express.json() — Chargily verifies its HMAC signature
    // against the raw request body. Once express.json() runs, the Buffer is gone.
    server.use(
      '/api/v1/payments/webhook',
      expressLib.raw({ type: 'application/json' }),
      (req: any, _res: any, next: any) => {
        if (Buffer.isBuffer(req.body)) {
          req.rawBody = req.body;
        }
        next();
      },
    );

    // ── Body size limit — protect against oversized payloads ────────────────
    app.use(expressLib.json({ limit: '1mb' }));
    app.use(expressLib.urlencoded({ extended: true, limit: '1mb' }));

    // ── Global prefix ───────────────────────────────────────────────────────
    app.setGlobalPrefix('api/v1');

    const configService = app.get(ConfigService) as ConfigService;
    const allowedOrigins = configService.get<string>(
      'ALLOWED_ORIGINS',
      'http://localhost:3000,http://localhost:8081',
    );

    // ── Helmet security headers ─────────────────────────────────────────────
    app.use(helmet());

    // ── Sentry error monitoring ─────────────────────────────────────────────
    const sentryDsn = configService.get<string>('SENTRY_DSN');
    if (sentryDsn) {
      Sentry.init({
        dsn: sentryDsn,
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
      });
    }

    // ── CORS ────────────────────────────────────────────────────────────────
    app.enableCors({
      origin: allowedOrigins.split(','),
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    // ── Global validation pipe ──────────────────────────────────────────────
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Initialize NestJS app context without listening on a port
    await app.init();
  }
}

export default async (req: Request, res: Response) => {
  await bootstrap();
  server(req, res);
};
