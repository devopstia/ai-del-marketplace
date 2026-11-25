import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { env } from '../config/env';
import { AuditService } from './audit.service';
import { EMAIL_QUEUE, JobsService, MEDIA_QUEUE, PAYMENTS_QUEUE } from './jobs';
import { PrismaService } from './prisma.service';
import { SalePricingService } from './sale-pricing';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

export function redisConnection() {
  const u = new URL(env().REDIS_URL);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({ useFactory: () => ({ connection: redisConnection() }) }),
    BullModule.registerQueue({ name: MEDIA_QUEUE }, { name: EMAIL_QUEUE }, { name: PAYMENTS_QUEUE }),
  ],
  providers: [PrismaService, AuditService, StorageService, SettingsService, JobsService, SalePricingService],
  exports: [PrismaService, AuditService, StorageService, SettingsService, JobsService, SalePricingService, BullModule],
})
export class CommonModule {}
