import { actingContextMiddleware } from './common/acting';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { CSRF_HEADER } from './common/cookies';
import { env } from './config/env';

/** Shared HTTP setup for main.ts and the e2e tests. */
export function configureApp(app: INestApplication) {
  const e = env();
  const express = app as NestExpressApplication;
  express.set('trust proxy', 'loopback, uniquelocal'); // real client IP behind the web proxy / Docker network
  express.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  // Course images are shown on the web app (another origin): allow embedding for this route only.
  app.use('/api/media/images', (_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.use(actingContextMiddleware);
  app.use(cookieParser());
  express.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: [e.WEB_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', CSRF_HEADER, 'X-CSRF-Token'],
    maxAge: 600,
  });
  app.enableShutdownHooks();
  return app;
}
