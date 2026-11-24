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

  async all() {
    return { commission_bps: await this.commissionBps() };
  }

  async set(key: 'commission_bps', value: number) {
    await this.prisma.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}
