/**
 * Last-resort two-step sign-in tools, run on the server (docs/AUTH.md):
 *   docker compose exec api node dist/auth/mfa-admin.js reset <email>   remove someone's authenticator (e.g. the only
 *       super admin lost their phone and recovery codes); they set up a new one at the next sign-in. Audit-logged.
 *   docker compose exec api node dist/auth/mfa-admin.js demo            local only: give the seed demo accounts the
 *       SEED_MFA_SECRET authenticator seed (so tests and demos can sign in).
 */
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { seal } from '../common/seal';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

const DEMO = ['admin@del.example', 'courses@del.example', 'nadia@instructor.example', 'student@del.example'];

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL }) });
  try {
    if (cmd === 'reset' && arg) {
      const u = await prisma.user.findUnique({ where: { email: arg.trim().toLowerCase() } });
      if (!u) throw new Error(`no account ${arg}`);
      await prisma.$transaction([
        prisma.user.update({ where: { id: u.id }, data: { mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null, failedLogins: 0, lockedUntil: null } }),
        prisma.mfaRecoveryCode.deleteMany({ where: { userId: u.id } }),
        prisma.trustedDevice.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.auditLog.create({ data: { actorId: null, action: 'auth.mfa_reset_by_admin', targetType: 'user', targetId: u.id, meta: { via: 'server-shell' } } }),
      ]);
      console.log(`Two-step sign-in removed for ${u.email}. They set up a new authenticator at their next sign-in.`);
    } else if (cmd === 'demo') {
      if (env().NODE_ENV === 'production') throw new Error('refused in production');
      const secret = env().SEED_MFA_SECRET.trim().toUpperCase();
      if (!/^[A-Z2-7]{16,64}$/.test(secret)) throw new Error('set SEED_MFA_SECRET (base32) in .env first');
      const r = await prisma.user.updateMany({ where: { email: { in: DEMO } }, data: { mfaSecret: seal('mfa', secret), mfaEnabledAt: new Date(), mfaLastStep: null, failedLogins: 0, lockedUntil: null } });
      console.log(`${r.count} demo accounts use the SEED_MFA_SECRET authenticator.`);
    } else {
      console.log('usage: mfa-admin reset <email> | demo');
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((e) => { console.error((e as Error).message); process.exit(1); });
