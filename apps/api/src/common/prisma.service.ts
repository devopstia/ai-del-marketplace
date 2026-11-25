import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../config/env';

/**
 * TLS for Amazon RDS (PostgreSQL 16 refuses unencrypted connections): verified against Amazon's RDS certificate
 * bundle (apps/api/assets/rds-global-bundle.pem, from truststore.pki.rds.amazonaws.com) when DATABASE_SSL=rds.
 */
export function databaseSsl() {
  if (env().DATABASE_SSL !== 'rds') return undefined;
  for (const p of [join(__dirname, '..', '..', 'assets', 'rds-global-bundle.pem'), join(process.cwd(), 'assets', 'rds-global-bundle.pem')]) {
    if (existsSync(p)) return { ca: readFileSync(p, 'utf8'), rejectUnauthorized: true };
  }
  throw new Error('RDS certificate bundle not found (apps/api/assets/rds-global-bundle.pem)');
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL, ssl: databaseSsl() }) });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
