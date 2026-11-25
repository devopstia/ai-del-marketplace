import { Injectable } from '@nestjs/common';
import { DEFAULT_COMMISSION_BPS } from './pricing';
import { PrismaService, Tx } from './prisma.service';

/** commission_bps: the platform's share of an independent instructor's sale (2000 = 20%, instructors keep 80%). */
export const DEFAULT_SETTINGS = { commission_bps: DEFAULT_COMMISSION_BPS } as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async commissionBps(tx?: Tx): Promise<number> {
    const row = await (tx ?? this.prisma).platformSetting.findUnique({ where: { key: 'commission_bps' } });
    const v = Number(row?.value ?? DEFAULT_SETTINGS.commission_bps);
    return Number.isInteger(v) && v >= 0 && v <= 10000 ? v : DEFAULT_SETTINGS.commission_bps;
  }

  /** Optional staff emails: new registrations (off by default) and instructor applications (on by default). */
  async flag(key: 'notify_new_registrations' | 'notify_instructor_applications') {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!row) return key === 'notify_instructor_applications';
    return row.value === true || row.value === 'true';
  }

  async all() {
    return {
      commission_bps: await this.commissionBps(),
      notify_new_registrations: await this.flag('notify_new_registrations'),
      notify_instructor_applications: await this.flag('notify_instructor_applications'),
    };
  }

  async set(key: 'commission_bps' | 'notify_new_registrations' | 'notify_instructor_applications', value: number | boolean) {
    await this.prisma.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}
