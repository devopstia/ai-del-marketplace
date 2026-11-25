import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface OutMail { to: string; subject: string; html: string; text: string; replyTo?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] }

const mask = (to: string) => to.replace(/^(.).*(@.*)$/, '$1***$2');
let transport: nodemailer.Transporter | null = null;

/**
 * Provider choice follows Insurance Hub (Resend in production, SMTP or console otherwise). Bodies, codes and links are
 * never logged; only the template name and a masked address.
 */
export async function sendMail(m: OutMail, template: string, log = new Logger('Email')) {
  const e = env();
  if (e.EMAIL_PROVIDER === 'console') {
    log.log(`[console] "${template}" to ${mask(m.to)}: ${m.subject.replace(/\b\d{6}\b/, '******')}`);
    return { provider: 'console' };
  }
  if (e.EMAIL_PROVIDER === 'smtp') {
    if (!e.SMTP_URL) throw new Error('SMTP_URL is not set');
    transport ??= nodemailer.createTransport(e.SMTP_URL);
    const r = await transport.sendMail({ from: e.EMAIL_FROM, to: m.to, replyTo: m.replyTo ?? e.EMAIL_REPLY_TO, subject: m.subject, html: m.html, text: m.text, attachments: m.attachments });
    log.log(`[smtp] "${template}" to ${mask(m.to)}`);
    return { provider: 'smtp', id: r.messageId };
  }
  if (!e.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: e.EMAIL_FROM, to: [m.to], reply_to: m.replyTo ?? e.EMAIL_REPLY_TO, subject: m.subject, html: m.html, text: m.text,
      attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString('base64'), content_type: a.contentType })),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
  const j = (await res.json()) as { id?: string };
  log.log(`[resend] "${template}" to ${mask(m.to)}`);
  return { provider: 'resend', id: j.id };
}
