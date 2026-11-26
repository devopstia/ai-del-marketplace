import { Injectable } from '@nestjs/common';
import { parseRoleConfig, type RolePermissionConfig } from './permissions';
import { PrismaService } from './prisma.service';

export const ROLE_CONFIG_KEY = 'role_permissions';
const TTL_MS = 10_000;

/**
 * The saved Role Management settings (platform_settings `role_permissions`), read by the global guard on every request.
 * Cached for 10 seconds per process; a save in this process clears the cache at once, other processes (the worker, a
 * second API) pick it up within 10 seconds.
 */
@Injectable()
export class RoleConfigService {
  private cached: { at: number; cfg: RolePermissionConfig } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<RolePermissionConfig> {
    if (this.cached && Date.now() - this.cached.at < TTL_MS) return this.cached.cfg;
    const row = await this.prisma.platformSetting.findUnique({ where: { key: ROLE_CONFIG_KEY } });
    const cfg = parseRoleConfig(row?.value);
    this.cached = { at: Date.now(), cfg };
    return cfg;
  }

  async save(cfg: RolePermissionConfig) {
    const value = { adminAllowed: cfg.adminAllowed, adminDefaults: cfg.adminDefaults, disabled: cfg.disabled };
    await this.prisma.platformSetting.upsert({ where: { key: ROLE_CONFIG_KEY }, create: { key: ROLE_CONFIG_KEY, value }, update: { value } });
    this.cached = null;
    return this.get();
  }
}
