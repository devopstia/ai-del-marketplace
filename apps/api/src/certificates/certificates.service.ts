import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Actor } from '../common/auth-context';
import { AuditService } from '../common/audit.service';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { env, stepUpSkipped } from '../config/env';
import { SignInService } from '../auth/signin.service';
import { certificateUrl } from '../catalogue/certificate-share';
import { type CertificateData, type Paper, RENDER_VERSION, renderCertificatePdf, renderCertificatePng, renderCertificateSvg } from './certificate-render';

export type CertFormat = 'svg' | 'png' | 'pdf';
const TYPES: Record<CertFormat, string> = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf' };
/** Sample data for the template preview in Super Admin › Certificates (never a real learner). */
export const SAMPLE: Omit<CertificateData, 'url'> = { code: 'DEL-SAMPLE00001', name: 'Amara Okafor', course: 'AI-Powered DevOps Automation with n8n', issuedAt: new Date('2026-11-27T12:00:00Z'), durationSec: 13956 };

/**
 * Certificates (docs/CERTIFICATES.md): the official Academic template rendered from the database record, public downloads
 * by code, and the super admin's revoke / restore / re-render. Issuance itself stays in LearningService (automatic on
 * completion).
 */
@Injectable()
export class CertificatesService {
  /** Small render cache: key = code + paper + format + RENDER_VERSION + a hash of the data drawn. */
  private cache = new Map<string, Buffer>();
  private cacheBytes = 0;
  private static readonly MAX_BYTES = 64 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signIn: SignInService,
  ) {}

  private async data(code: string): Promise<CertificateData> {
    const cert = await this.prisma.certificate.findUnique({
      where: { code },
      select: { code: true, issuedAt: true, revokedAt: true, user: { select: { name: true } }, course: { select: { title: true, sections: { select: { lectures: { select: { durationSec: true } } } } } } },
    });
    if (!cert) throw notFound('Certificate');
    return {
      code: cert.code,
      name: cert.user.name,
      course: cert.course.title,
      issuedAt: cert.issuedAt,
      durationSec: cert.course.sections.flatMap((s) => s.lectures).reduce((n, l) => n + l.durationSec, 0),
      url: certificateUrl(env().WEB_URL, cert.code),
      revoked: !!cert.revokedAt,
    };
  }

  /** The certificate file: same drawing for SVG, 300-dpi PNG and one-page PDF. */
  async file(code: string, format: CertFormat, paper: Paper) {
    const data = await this.data(code);
    return { body: this.render(data, format, paper), type: TYPES[format], filename: `DEL-certificate-${data.code}${paper === 'a4' ? '-A4' : ''}.${format}` };
  }

  /** The official template with sample data (Super Admin › Certificates). */
  sample(format: CertFormat, paper: Paper) {
    return { body: this.render({ ...SAMPLE, url: certificateUrl(env().WEB_URL, SAMPLE.code) }, format, paper), type: TYPES[format] };
  }

  private render(data: CertificateData, format: CertFormat, paper: Paper): Buffer {
    const hash = createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 12);
    const key = `${data.code}:${paper}:${format}:${RENDER_VERSION}:${hash}`;
    const hit = this.cache.get(key);
    if (hit) { this.cache.delete(key); this.cache.set(key, hit); return hit; }
    const { svg } = renderCertificateSvg(data, paper);
    const out = format === 'svg' ? Buffer.from(svg) : format === 'png' ? renderCertificatePng(svg, paper).png : renderCertificatePdf(svg, paper, `Certificate of Completion: ${data.course}`);
    this.cache.set(key, out);
    this.cacheBytes += out.length;
    for (const [k, v] of this.cache) {
      if (this.cacheBytes <= CertificatesService.MAX_BYTES) break;
      this.cache.delete(k);
      this.cacheBytes -= v.length;
    }
    return out;
  }

  private forget(code: string) {
    for (const [k, v] of this.cache) if (k.startsWith(`${code}:`)) { this.cache.delete(k); this.cacheBytes -= v.length; }
  }

  // ---------- Super Admin › Certificates ----------

  async list(q?: string, page = 1, pageSize = 25) {
    const term = q?.trim();
    const where = term
      ? { OR: [{ code: { contains: term, mode: 'insensitive' as const } }, { user: { name: { contains: term, mode: 'insensitive' as const } } }, { course: { title: { contains: term, mode: 'insensitive' as const } } }] }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where, orderBy: { issuedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { code: true, issuedAt: true, revokedAt: true, revokedReason: true, user: { select: { id: true, name: true } }, course: { select: { title: true, slug: true } } },
      }),
    ]);
    return { total, page, pageSize, items: rows.map((r) => ({ code: r.code, issuedAt: r.issuedAt, status: r.revokedAt ? 'revoked' : 'valid', revokedAt: r.revokedAt, revokedReason: r.revokedReason, student: r.user, course: r.course })) };
  }

  private async stepUp(a: Actor, code?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { mfaEnabledAt: true } });
    if (stepUpSkipped(!!me?.mfaEnabledAt)) return;
    if (!code) throw badRequest('Enter the six-digit code from your Google Authenticator app to confirm this change.', 'step_up_required');
    await this.signIn.checkCode(a.user.id, code, a.ip);
  }

  private async find(code: string) {
    const c = await this.prisma.certificate.findUnique({ where: { code }, select: { id: true, code: true, revokedAt: true, userId: true, courseId: true } });
    if (!c) throw notFound('Certificate');
    return c;
  }

  async revoke(a: Actor, code: string, input: { reason: string; code?: string }) {
    await this.stepUp(a, input.code);
    const c = await this.find(code);
    if (c.revokedAt) throw conflict('This certificate is already revoked', 'already_revoked');
    await this.prisma.certificate.update({ where: { id: c.id }, data: { revokedAt: new Date(), revokedReason: input.reason.trim(), revokedById: a.user.id } });
    this.forget(code);
    await this.audit.log({ actorId: a.user.id, action: 'certificate.revoked', targetType: 'certificate', targetId: c.id, ip: a.ip, meta: { code, reason: input.reason.trim(), userId: c.userId, courseId: c.courseId } });
    return { code, status: 'revoked' as const };
  }

  async restore(a: Actor, code: string, input: { reason: string; code?: string }) {
    await this.stepUp(a, input.code);
    const c = await this.find(code);
    if (!c.revokedAt) throw conflict('This certificate is not revoked', 'not_revoked');
    await this.prisma.certificate.update({ where: { id: c.id }, data: { revokedAt: null, revokedReason: null, revokedById: null } });
    this.forget(code);
    await this.audit.log({ actorId: a.user.id, action: 'certificate.restored', targetType: 'certificate', targetId: c.id, ip: a.ip, meta: { code, reason: input.reason.trim() } });
    return { code, status: 'valid' as const };
  }

  /** Re-render with the current name, title and template (the code never changes). */
  async reissue(a: Actor, code: string) {
    const c = await this.find(code);
    this.forget(code);
    await this.audit.log({ actorId: a.user.id, action: 'certificate.rerendered', targetType: 'certificate', targetId: c.id, ip: a.ip, meta: { code, renderVersion: RENDER_VERSION } });
    return { code, renderVersion: RENDER_VERSION };
  }
}
