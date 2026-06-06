// services/api/src/main.ts
// NestJS application bootstrap
// SECURITY: Swagger disabled in production, body size limited to 1 MB,
//           graceful shutdown hooks enabled.

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { AppModule } from './app.module';
import { validateEnvironment } from './config/env.validation';

async function bootstrap() {
  // ── Env validation: fail fast before touching anything else ──────────────
  validateEnvironment();

  const app = await NestFactory.create(AppModule, {
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

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  // ── Body size limit — protect against oversized payloads ─────────────────
  // IMPORTANT: The Chargily webhook route needs the raw body for HMAC signature
  // verification. We apply express.raw() BEFORE the global JSON parser so the
  // rawBody buffer is available in req.rawBody for that specific route.
  app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json' }),
    (req: express.Request & { rawBody?: Buffer }, _res: express.Response, next: express.NextFunction) => {
      if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
      }
      next();
    },
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  const configService = app.get(ConfigService);
  const allowedOrigins = configService.get<string>(
    'ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:8081',
  );

  // ── Helmet security headers ───────────────────────────────────────────────
  app.use(helmet());

  // ── Sentry error monitoring ───────────────────────────────────────────────
  const sentryDsn = configService.get<string>('SENTRY_DSN');
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [nodeProfilingIntegration()],
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
    });
  }

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: allowedOrigins.split(','),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Global validation pipe ────────────────────────────────────────────────
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

  const port = configService.get<number>('PORT', 3000);

  // ── Swagger — disabled in production ─────────────────────────────────────
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BarberDZ API')
      .setDescription('The BarberDZ backend API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document);
    Logger.log(
      `📄 Swagger documentation available at http://localhost:${port}/api/v1/docs`,
      'Bootstrap',
    );
  }

  await app.listen(port);
  Logger.log(
    `🚀 BarberDZ API running on http://localhost:${port}/api/v1 [${nodeEnv}]`,
    'Bootstrap',
  );
}

bootstrap();
