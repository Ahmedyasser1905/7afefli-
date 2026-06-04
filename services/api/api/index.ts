// services/api/api/index.ts
// Vercel serverless entry point for NestJS API
// Uses singleton bootstrap pattern to minimize cold starts.

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
import * as express from 'express';
import { AppModule } from '../src/app.module';
import { validateEnvironment } from '../src/config/env.validation';

const server = express();
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

    // ── Body size limit — protect against oversized payloads ────────────────
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
        whitelist: true,            // Strip unknown properties
        forbidNonWhitelisted: true, // Throw on unknown properties
        transform: true,            // Auto-transform payloads to DTO instances
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Initialize NestJS app context without listening on a port
    await app.init();
  }
}

export default async (req: express.Request, res: express.Response) => {
  await bootstrap();
  server(req, res);
};
