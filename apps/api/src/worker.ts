import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { env } from './config/env';
import { WorkerModule } from './worker/worker.module';

/** Same image as the API, different entrypoint: BullMQ processors only, no HTTP. */
async function main() {
  env();
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('worker started (queues: media, email)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
