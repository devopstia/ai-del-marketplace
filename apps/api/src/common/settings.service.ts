import { Injectable } from '@nestjs/common';
import { PrismaService, Tx } from './prisma.service';

export const DEFAULT_SETTINGS = { commission_bps: 0 } as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async commissionBps(tx?: Tx): Promise<number> {
    const row = await (tx ?? this.prisma).platformSetting.findUnique({ where: { key: 'commission_bps' } });
    const v = Number(row?.value ?? DEFAULT_SETTINGS.commission_bps);
    return Number.isInteger(v) && v >= 0 && v <= 10000 ? v : 0;
  }

  async all() {
    return { commission_bps: await this.commissionBps() };
  }

  async set(key: 'commission_bps', value: number) {
    await this.prisma.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}
