import { env } from '../config/env';

/**
 * DEL email layout, adapted from Insurance Hub's notification-service `_base.html` (docs/EMAIL.md): a 560px card on a
 * soft background, a brand rule, the logo with the name in type (images may be blocked), a hidden preheader, and the
 * footer with the support address. Tables and inline styles throughout because email clients strip most CSS.
 * Differences from the Hub: DEL branding and colours, and a dark-mode variant for clients that honour
 * `prefers-color-scheme` (Apple Mail, iOS, Outlook apps); everything still reads well in light-only clients.
 */
export type Block =
  | { h1: string }
  | { p: string }
  | { muted: string }
  | { cta: { href: string; label: string } }
  | { list: string[] }
  | { code: string }
  | { rows: [string, string][] }
  | { link: string }
  | { note: string };

const C = { bg: '#F3F2FA', card: '#FFFFFF', line: '#E3E1F0', ink: '#141833', ink2: '#3A3D63', muted: '#5A5D80', violet: '#4F3FB0', cyan: '#1E9BD7', soft: '#F6F5FD' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escapes text; `**bold**` becomes <strong> (the only markup the templates use). */
export function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\*\*(.+?)\*\*/g, '<strong style="color:' + C.ink + ';">$1</strong>');
}
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');

function html(b: Block): string {
  if ('h1' in b) return `<h1 class="ink" style="margin:0 0 14px;font-size:22px;font-weight:700;line-height:1.28;color:${C.ink};letter-spacing:-0.01em;">${esc(b.h1)}</h1>`;
  if ('p' in b) return `<p class="ink2" style="margin:0 0 14px;color:${C.ink2};">${esc(b.p)}</p>`;
  if ('muted' in b) return `<p class="muted" style="margin:0 0 14px;color:${C.muted};font-size:13.5px;">${esc(b.muted)}</p>`;
  if ('note' in b) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td class="soft" style="background:${C.soft};border-left:3px solid ${C.violet};border-radius:6px;padding:12px 14px;color:${C.ink2};font-size:14px;">${esc(b.note)}</td></tr></table>`;
  if ('list' in b) return `<ul class="ink2" style="margin:0 0 16px;padding-left:20px;color:${C.ink2};">${b.list.map((x) => `<li style="margin:0 0 6px;">${esc(x)}</li>`).join('')}</ul>`;
  if ('code' in b) return `<p style="margin:4px 0 18px;"><span class="code" style="display:inline-block;padding:12px 18px;border:1px solid ${C.line};border-radius:8px;background:${C.soft};font-family:Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:${C.ink};">${esc(b.code)}</span></p>`;
  if ('rows' in b) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-top:1px solid ${C.line};" class="rows">${b.rows.map(([k, v]) => `<tr><td class="muted" style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.muted};font-size:14px;">${esc(k)}</td><td class="ink" align="right" style="padding:9px 0 9px 12px;border-bottom:1px solid ${C.line};color:${C.ink};font-size:14px;font-weight:600;">${esc(v)}</td></tr>`).join('')}</table>`;
  if ('link' in b) return `<p class="muted" style="margin:0 0 14px;color:${C.muted};font-size:13px;">If the button doesn’t work, paste this link into your browser:<br><span style="font-family:Menlo,Consolas,monospace;font-size:11px;word-break:break-all;">${esc(b.link)}</span></p>`;
  const { href, label } = b.cta;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;"><tr><td align="center" bgcolor="${C.violet}" class="btn" style="border-radius:8px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(href)}" style="height:46px;v-text-anchor:middle;width:280px;" arcsize="16%" fillcolor="${C.violet}" stroke="f"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;"><![endif]-->
<a href="${esc(href)}" class="btn-a" style="display:inline-block;padding:13px 28px;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;">${esc(label)}</a>
<!--[if mso]></center></v:roundrect><![endif]--></td></tr></table>`;
}

function text(b: Block): string {
  if ('h1' in b) return `${plain(b.h1)}\n${'='.repeat(Math.min(60, b.h1.length))}`;
  if ('p' in b) return plain(b.p);
  if ('muted' in b) return plain(b.muted);
  if ('note' in b) return `> ${plain(b.note)}`;
  if ('list' in b) return b.list.map((x) => `- ${plain(x)}`).join('\n');
  if ('code' in b) return `    ${b.code}`;
  if ('rows' in b) return b.rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  if ('link' in b) return '';
  return `${b.cta.label}: ${b.cta.href}`;
}

export interface Rendered { subject: string; html: string; text: string }

export function layout(input: { subject: string; preheader?: string; blocks: Block[]; why?: string }): Rendered {
  const e = env();
  const web = e.WEB_URL.replace(/\/$/, '');
  const host = web.replace(/^https?:\/\//, '');
  const support = e.EMAIL_REPLY_TO || 'support@devopseasylearning.com';
  const why = input.why ?? 'You receive this email because of activity on your DevOps Easy Learning account.';
  const body = input.blocks.map(html).join('\n');
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(input.subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background:#0C0F22 !important; }
    .card { background:#141834 !important; border-color:#262C52 !important; }
    .foot { background:#10142B !important; border-color:#262C52 !important; }
    .ink, .ink strong, h1 { color:#E8EAF7 !important; }
    .ink2, .ink2 strong { color:#C9CCE3 !important; }
    .muted { color:#9599B8 !important; }
    .soft, .code { background:#1B2045 !important; color:#E8EAF7 !important; border-color:#262C52 !important; }
    .btn { background:#9D8FFF !important; }
    .btn-a { color:#12143A !important; }
    .link { color:#9D8FFF !important; }
    .rows, .rows td, .divider { border-color:#262C52 !important; }
  }
  @media (max-width: 600px) { .pad { padding-left:20px !important; padding-right:20px !important; } }
</style>
<!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
</head>
<body class="bg" style="margin:0;padding:0;background:${C.bg};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader ?? input.subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:${C.bg};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:12px;overflow:hidden;font-family:${FONT};">
<tr><td style="height:4px;background:${C.violet};background-image:linear-gradient(90deg,${C.violet},${C.cyan});font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td class="pad" style="padding:24px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:12px;vertical-align:middle;"><img src="${web}/icons/icon-192.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
<td style="vertical-align:middle;"><div class="ink" style="font-size:17px;font-weight:800;color:${C.ink};letter-spacing:-0.01em;line-height:1.1;">DevOps Easy Learning</div>
<div style="margin-top:3px;font-size:10px;font-weight:700;color:${C.violet};text-transform:uppercase;letter-spacing:0.2em;" class="link">AI &amp; DevOps courses</div></td>
</tr></table>
</td></tr>
<tr><td class="pad ink2" style="padding:22px 32px 26px;color:${C.ink2};font-size:15px;line-height:1.62;">
${body}
</td></tr>
<tr><td class="pad foot muted" style="border-top:1px solid ${C.line};padding:20px 32px;background:#FAFAFE;color:${C.muted};font-size:12px;line-height:1.6;">
Questions? Write to <a class="link" href="mailto:${esc(support)}" style="color:${C.violet};text-decoration:none;">${esc(support)}</a> or reply to this email.
<div class="divider" style="margin-top:12px;padding-top:12px;border-top:1px solid ${C.line};"><strong class="ink" style="color:${C.ink2};">DevOps Easy Learning</strong><br>Learn AI and DevOps the way production works.<br><a class="link" href="${web}" style="color:${C.violet};text-decoration:none;">${esc(host)}</a></div>
</td></tr>
</table>
<div class="muted" style="max-width:560px;margin:14px auto 0;color:#8A8DAA;font-size:11px;line-height:1.55;text-align:center;font-family:${FONT};">${esc(why)}</div>
</td></tr>
</table>
</body>
</html>`;
  const txt = [...input.blocks.map(text).filter(Boolean), '', '--', 'DevOps Easy Learning', `${web}`, `Questions? ${support}`, '', why].join('\n\n').replace(/\n{3,}/g, '\n\n');
  return { subject: input.subject, html: doc, text: txt };
}
