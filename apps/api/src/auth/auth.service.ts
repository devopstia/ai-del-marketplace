import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../common/audit.service';
import { hashSessionToken } from '../common/auth.guard';
import { SESSION_TTL_MS } from '../common/cookies';
import { AppError, conflict, notFound, unauthorized } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { randomToken } from '../common/util';

export const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

const publicUser = { id: true, email: true, name: true, avatarUrl: true, roles: true, status: true, createdAt: true } as const;

interface Ctx {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  hashPassword(pw: string) {
    return argon2.hash(pw, ARGON2_OPTS);
  }

  async register(input: { email: string; password: string; name: string }, ctx: Ctx) {
    const email = input.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw conflict('An account with this email already exists', 'email_taken');
    const user = await this.prisma.user.create({
      data: { email, name: input.name.trim(), passwordHash: await this.hashPassword(input.password), roles: ['student'] },
      select: publicUser,
    });
    await this.audit.log({ actorId: user.id, action: 'auth.register', targetType: 'user', targetId: user.id, ip: ctx.ip });
    const token = await this.createSession(user.id, ctx);
    return { user, token };
  }

  async login(input: { email: string; password: string }, ctx: Ctx) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Verify against a dummy hash when the user doesn't exist, so timing doesn't reveal which emails are registered.
    this.dummyHash ??= this.hashPassword(randomToken(16));
    const ok = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), input.password).catch(() => false);
    if (!user || !ok) {
      await this.audit.log({ actorId: user?.id ?? null, action: 'auth.login_failed', targetType: 'user', targetId: user?.id, ip: ctx.ip, meta: { email } });
      throw unauthorized('Email or password is incorrect', 'invalid_credentials');
    }
    if (user.status !== 'active') throw new AppError(403, 'account_suspended', 'This account is suspended');
    if (argon2.needsRehash(user.passwordHash, ARGON2_OPTS)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.hashPassword(input.password) } });
    }
    await this.audit.log({ actorId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id, ip: ctx.ip });
    const token = await this.createSession(user.id, ctx);
    const { passwordHash: _p, ...safe } = user;
    return { user: safe, token };
  }

  async createSession(userId: string, ctx: Ctx): Promise<string> {
    const token = randomToken(32);
    await this.prisma.session.create({
      data: {
        id: hashSessionToken(token),
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: ctx.ip,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
      },
    });
    return token;
  }

  async revokeSession(sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...publicUser, instructorProfile: { select: { status: true, payoutsEnabled: true, isPlatform: true } } },
    });
    if (!user) throw notFound('User');
    const { instructorProfile, ...rest } = user;
    return { ...rest, instructor: instructorProfile };
  }

  /** DEL's own instructor account (the platform-owned profile), for the super admin's "DEL Studio" switch. */
  async platformInstructor() {
    const p = await this.prisma.instructorProfile.findFirst({ where: { isPlatform: true, status: 'approved' }, orderBy: { createdAt: 'asc' }, select: { user: { select: { id: true, name: true } } } });
    return p?.user ?? null;
  }

  async listSessions(userId: string, currentId?: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true, ip: true, userAgent: true },
    });
    return rows.map((r) => ({ ...r, current: r.id === currentId }));
  }

  async revokeOwnSession(userId: string, sessionId: string, ip: string | null) {
    const r = await this.prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!r.count) throw notFound('Session');
    await this.audit.log({ actorId: userId, action: 'auth.session_revoked', targetType: 'session', targetId: sessionId, ip });
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string | null }) {
    return this.prisma.user.update({ where: { id: userId }, data, select: publicUser });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId: string | undefined, ip: string | null) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, currentPassword).catch(() => false))) {
      throw unauthorized('Current password is incorrect', 'invalid_credentials');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(newPassword) } });
    // Sign out every other device.
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, NOT: keepSessionId ? { id: keepSessionId } : undefined },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ actorId: userId, action: 'auth.password_changed', targetType: 'user', targetId: userId, ip });
  }
}
