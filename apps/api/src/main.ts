import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { devPaymentsEnabled, env } from './config/env';

async function main() {
  const e = env(); // fail fast on a bad environment
  // rawBody keeps the exact bytes for Stripe/Mux webhook signature verification.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bufferLogs: false });
  configureApp(app);
  await app.listen(e.PORT, '0.0.0.0');
  const log = new Logger('API');
  log.log(`listening on :${e.PORT} (NODE_ENV=${e.NODE_ENV}, video=${e.VIDEO_PROVIDER}, stripe=${e.STRIPE_SECRET_KEY ? 'on' : 'off'}, devTestPayments=${devPaymentsEnabled() ? 'on' : 'off'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
