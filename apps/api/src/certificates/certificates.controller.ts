import { Controller, Get, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, Public, Roles, type Actor } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { CertificatesService, type CertFormat } from './certificates.service';

const paperQuery = z.object({ paper: z.enum(['letter', 'a4']).default('letter'), download: z.enum(['1', '0']).optional() });
const codeParam = z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9-]+$/);
const listQuery = z.object({ q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).max(1000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
const changeBody = z.object({ reason: z.string().trim().min(3).max(500), code: z.string().trim().max(12).optional() });

function send(res: Response, f: { body: Buffer; type: string; filename?: string }, download: boolean) {
  res.setHeader('Content-Type', f.type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Public by link like the verification page; short cache so a revocation shows quickly.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (f.type === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  if (f.filename) res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${f.filename}"`);
  res.end(f.body);
}

/** The official certificate as SVG, 300-dpi PNG and one-page PDF (docs/CERTIFICATES.md). Public by code, rate limited. */
@Controller()
export class CertificatesController {
  constructor(private readonly svc: CertificatesService) {}

  private async out(code: string, format: CertFormat, q: z.infer<typeof paperQuery>, res: Response) {
    const parsed = codeParam.safeParse(code);
    if (!parsed.success) { res.status(404).json({ error: { code: 'not_found', message: 'Certificate not found' } }); return; }
    send(res, await this.svc.file(parsed.data, format, q.paper), format !== 'svg' && q.download !== '0');
  }

  @Public() @UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('certificates/:code/certificate.svg')
  svg(@Param('code') code: string, @ZQuery(paperQuery) q: z.infer<typeof paperQuery>, @Res() res: Response) { return this.out(code, 'svg', q, res); }

  @Public() @UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('certificates/:code/certificate.png')
  png(@Param('code') code: string, @ZQuery(paperQuery) q: z.infer<typeof paperQuery>, @Res() res: Response) { return this.out(code, 'png', q, res); }

  @Public() @UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('certificates/:code/certificate.pdf')
  pdf(@Param('code') code: string, @ZQuery(paperQuery) q: z.infer<typeof paperQuery>, @Res() res: Response) { return this.out(code, 'pdf', q, res); }

  // ---------- Super Admin › Certificates ----------
  @Roles('super_admin') @Get('admin/certificates')
  list(@ZQuery(listQuery) q: z.infer<typeof listQuery>) { return this.svc.list(q.q, q.page, q.pageSize); }

  @Roles('super_admin') @Get('admin/certificates/template.svg')
  template(@ZQuery(paperQuery) q: z.infer<typeof paperQuery>, @Res() res: Response) { send(res, this.svc.sample('svg', q.paper), false); }

  @Roles('super_admin') @HttpCode(200) @Post('admin/certificates/:code/revoke')
  revoke(@Param('code') code: string, @ZBody(changeBody) b: z.infer<typeof changeBody>, @ActorCtx() a: Actor) { return this.svc.revoke(a, code, b); }

  @Roles('super_admin') @HttpCode(200) @Post('admin/certificates/:code/restore')
  restore(@Param('code') code: string, @ZBody(changeBody) b: z.infer<typeof changeBody>, @ActorCtx() a: Actor) { return this.svc.restore(a, code, b); }

  @Roles('super_admin') @HttpCode(200) @Post('admin/certificates/:code/rerender')
  rerender(@Param('code') code: string, @ActorCtx() a: Actor) { return this.svc.reissue(a, code); }
}
