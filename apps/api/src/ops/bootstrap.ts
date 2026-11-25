/**
 * Production bootstrap (docs/DEPLOYMENT.md), run once inside the API container:
 *   node dist/ops/bootstrap.js
 * Creates, if missing: DevOps Easy Learning's own instructor profile (the platform account behind "DEL Studio",
 * no sign-in) and the first super admin (BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD from SSM). The super admin
 * sets up Google Authenticator at the first sign-in like everyone else. No courses, no demo data, no videos.
 */
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { ARGON2_OPTS } from '../auth/auth.service';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  if (!email || password.length < 16) throw new Error('BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of 16+ characters are required');

  const delEmail = 'del-platform@ai-devopseasylearning.com';
  let del = await prisma.user.findUnique({ where: { email: delEmail } });
  if (!del) {
    del = await prisma.user.create({ data: { email: delEmail, name: 'DevOps Easy Learning', passwordHash: null, roles: ['student', 'instructor'], signupMethod: 'seed', emailVerifiedAt: new Date() } });
    await prisma.instructorProfile.create({ data: { userId: del.id, status: 'approved', isPlatform: true, headline: 'Practical AI and DevOps courses', bio: 'DevOps Easy Learning teaches AI and DevOps with hands-on labs.', website: 'https://www.devopseasylearning.com' } });
    console.log('created the DevOps Easy Learning platform instructor');
  }

  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    await prisma.user.create({ data: { email, name: 'DEL Super Admin', passwordHash: await argon2.hash(password, ARGON2_OPTS), passwordChangedAt: new Date(), roles: ['student', 'admin', 'super_admin'], signupMethod: 'seed', emailVerifiedAt: new Date() } });
    console.log(`created the super admin ${email.replace(/^(.).*(@.*)$/, '$1***$2')} (Google Authenticator is set up at the first sign-in)`);
  } else console.log('super admin already exists; nothing changed');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
