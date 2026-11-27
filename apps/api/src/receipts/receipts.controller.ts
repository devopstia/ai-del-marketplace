import { Controller, Get, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, Perm, Roles } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { ReceiptsService } from './receipts.service';

const paperQuery = z.object({ paper: z.enum(['letter', 'a4']).default('letter') });
const companyBody = z.object({
  legalName: z.string().trim().max(120).optional(),
  address: z.string().trim().max(400).optional(),
  supportEmail: z.string().trim().max(200).optional(),
  website: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(60).optional(),
}).strict();

function sendPdf(res: Response, pdf: Uint8Array, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]/g, '')}"`);
  // Private financial document: never cached by shared caches.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(Buffer.from(pdf));
}

/**
 * Receipts (owner 2026-11-27, docs/RECEIPTS.md). Signed-in only (the global guard): the buyer reaches their own; admins
 * with "orders.view" reach any. No public link, unlike certificates.
 */
@Controller()
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get('orders/:id/receipt')
  mine(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.receipts.forUser(a.user.id, id);
  }

  @Get('orders/:id/receipt.pdf')
  async minePdf(@Param('id') id: string, @ZQuery(paperQuery) q: z.infer<typeof paperQuery>, @ActorCtx() a: Actor, @Res() res: Response) {
    const r = await this.receipts.forUser(a.user.id, id);
    const { pdf, filename } = await this.receipts.pdf(r, q.paper);
    sendPdf(res, pdf, filename);
  }

  @Perm('orders.view') @Get('admin/orders/:id/receipt')
  admin(@Param('id') id: string) {
    return this.receipts.forAdmin(id);
  }

  @Perm('orders.view') @Get('admin/orders/:id/receipt.pdf')
  async adminPdf(@Param('id') id: string, @ZQuery(paperQuery) q: z.infer<typeof paperQuery>, @Res() res: Response) {
    const r = await this.receipts.forAdmin(id);
    const { pdf, filename } = await this.receipts.pdf(r, q.paper);
    sendPdf(res, pdf, filename);
  }

  @Perm('orders.view') @HttpCode(200) @Post('admin/orders/:id/receipt/resend')
  resend(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.receipts.resend(a, id);
  }

  @Roles('super_admin') @Get('admin/settings/company')
  company() {
    return this.receipts.companySettings();
  }

  @Roles('super_admin') @Put('admin/settings/company')
  setCompany(@ZBody(companyBody) b: z.infer<typeof companyBody>, @ActorCtx() a: Actor) {
    return this.receipts.setCompany(a, b);
  }
}
