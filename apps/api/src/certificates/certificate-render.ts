import { Resvg } from '@resvg/resvg-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import * as opentype from 'opentype.js';
import * as QRCode from 'qrcode';

/**
 * The official DevOps Easy Learning certificate, "Academic Excellence" (owner's choice 2026-11-27; docs/CERTIFICATES.md).
 * One server-rendered SVG is the single source of truth: the web preview shows it, the PNG is it at 300 dpi and the PDF is
 * that PNG on one page of the exact paper size, so all three always match. Text is drawn as paths with the real fonts
 * (EB Garamond, Schibsted Grotesk), measured to fit: long names and titles shrink, then wrap to two lines, never overflow.
 * Colours are fixed (never follow the viewer's theme). Bump RENDER_VERSION after changing anything drawn here.
 */
export const RENDER_VERSION = 'a1';

export type Paper = 'letter' | 'a4';
/** Drawing units: the page is always 1100 wide; Letter is 11 × 8.5 in, A4 is 297 × 210 mm at the same width. */
export const PAGE: Record<Paper, { w: number; h: number; ptW: number; ptH: number; pxW: number }> = {
  letter: { w: 1100, h: 850, ptW: 792, ptH: 612, pxW: 3300 },
  a4: { w: 1100, h: 778, ptW: 841.89, ptH: 595.28, pxW: 3508 },
};

/** The institutional signature, one place for every certificate (never a person's handwriting). */
export const SIGNATURE = { lead: 'Issued and verified by', title: 'Authorized Representative', org: 'DevOps Easy Learning' } as const;
export const ISSUER = 'DevOps Easy Learning';

export interface CertificateData {
  code: string;
  name: string;
  course: string;
  issuedAt: Date;
  /** Total video length in seconds (0 = not shown). */
  durationSec: number;
  /** Full verification link the QR opens, e.g. https://ai-devopseasylearning.com/certificates/DEL-… */
  url: string;
  revoked?: boolean;
}

const C = { paper: '#fbf8f1', navy: '#1f3a5f', ink: '#1f2433', muted: '#4a4f5e', gold: '#9b7b3a', violet: '#4f3fb0', cyan: '#1e9bd7', red: '#b42318' };

// ---------- fonts ----------
function fontDir() {
  for (const d of [join(__dirname, '..', '..', 'assets', 'fonts'), join(process.cwd(), 'assets', 'fonts'), join(process.cwd(), 'apps', 'api', 'assets', 'fonts')]) {
    if (existsSync(join(d, 'EBGaramond-Regular.ttf'))) return d;
  }
  throw new Error('Certificate fonts not found (apps/api/assets/fonts)');
}
type Fonts = { regular: opentype.Font; medium: opentype.Font; semibold: opentype.Font; italic: opentype.Font; sans: opentype.Font; files: string[] };
let fontCache: Fonts | null = null;
function fonts(): Fonts {
  if (fontCache) return fontCache;
  const dir = fontDir();
  const load = (f: string) => {
    const b = readFileSync(join(dir, f));
    return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  };
  const files = ['EBGaramond-Regular.ttf', 'EBGaramond-Medium.ttf', 'EBGaramond-SemiBold.ttf', 'EBGaramond-Italic.ttf', 'SchibstedGrotesk-700.ttf'];
  fontCache = { regular: load(files[0]!), medium: load(files[1]!), semibold: load(files[2]!), italic: load(files[3]!), sans: load(files[4]!), files: files.map((f) => join(dir, f)) };
  return fontCache;
}

// ---------- text ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
interface Run { font: opentype.Font; size: number; spacing?: number }
export const textWidth = (r: Run, t: string) => r.font.getAdvanceWidth(t, r.size, { kerning: true, letterSpacing: r.spacing ?? 0 });

/** A line of text as one path, anchored left / middle / end at the baseline y. Returns the path and its box. */
function line(r: Run, t: string, x: number, y: number, fill: string, anchor: 'start' | 'middle' | 'end' = 'middle') {
  const w = textWidth(r, t);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const d = r.font.getPath(t, x0, y, r.size, { kerning: true, letterSpacing: r.spacing ?? 0 }).toPathData(2);
  return { svg: d ? `<path d="${d}" fill="${fill}"/>` : '', x0, x1: x0 + w, w };
}

function wrap(r: Run, text: string, maxW: number): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if (textWidth(r, w) > maxW) return null;
    const next = cur ? `${cur} ${w}` : w;
    if (textWidth(r, next) <= maxW) cur = next;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

export interface Fitted { size: number; lines: string[] }
/**
 * Largest size from `max` down to `min` at which `text` fits on one line of `maxW`; below `oneLineMin` it may use two
 * lines. At `min` a still-too-long last line is shortened with "…" (never happens for names under ~90 characters).
 */
export function fit(font: opentype.Font, text: string, maxW: number, max: number, oneLineMin: number, min: number, spacing = 0): Fitted {
  for (let s = max; s >= oneLineMin; s -= 1) if (textWidth({ font, size: s, spacing }, text) <= maxW) return { size: s, lines: [text] };
  for (let s = Math.min(max, oneLineMin + 6); s >= min; s -= 1) {
    const l = wrap({ font, size: s, spacing }, text, maxW);
    if (l && l.length <= 2) return { size: s, lines: l };
  }
  const r = { font, size: min, spacing };
  const l = wrap(r, text, maxW) ?? [text];
  const lines = l.slice(0, 2);
  if (l.length > 2 || textWidth(r, lines[lines.length - 1]!) > maxW) {
    let last = lines[lines.length - 1]!;
    while (last.length > 1 && textWidth(r, `${last}…`) > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return { size: min, lines };
}

// ---------- marks ----------
const LOOP_L = 'M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30';
const LOOP_R = 'M60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30';
function loop(x: number, y: number, w: number, a: string, b: string, sw = 10) {
  const k = w / 120;
  return `<g transform="translate(${x} ${y}) scale(${k})" fill="none" stroke-linecap="round" stroke-width="${sw}"><path d="${LOOP_L}" stroke="${a}"/><path d="${LOOP_R}" stroke="${b}"/><path d="M50,17 L60,30" stroke="${a}"/></g>`;
}

/** The official seal: gold double ring, the issuer's name around it, the DEL loop in the centre. */
function seal(cx: number, cy: number, r: number) {
  const f = fonts().sans;
  const text = 'DEVOPS EASY LEARNING • OFFICIAL SEAL • ';
  const size = r * 0.17;
  const rr = r * 0.72; // text baseline radius
  const run = { font: f, size, spacing: 0.12 };
  const total = textWidth(run, text);
  const scale = (2 * Math.PI * rr) / total; // spread the text evenly around the ring
  let a = -Math.PI / 2;
  let glyphs = '';
  for (const ch of text) {
    const adv = textWidth(run, ch) * scale;
    const mid = a + adv / 2 / rr;
    const x = cx + rr * Math.cos(mid);
    const y = cy + rr * Math.sin(mid);
    const gw = textWidth({ font: f, size }, ch);
    const d = f.getPath(ch, -gw / 2, size * 0.35, size).toPathData(2);
    if (d) glyphs += `<path d="${d}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${((mid * 180) / Math.PI + 90).toFixed(2)})" fill="${C.gold}"/>`;
    a += adv / rr;
  }
  return `<g>
<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${C.gold}" stroke-width="1"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.paper}" stroke="${C.gold}" stroke-width="2"/>
<circle cx="${cx}" cy="${cy}" r="${r * 0.52}" fill="none" stroke="${C.gold}" stroke-width="1"/>
${glyphs}
${loop(cx - r * 0.36, cy - r * 0.18, r * 0.72, C.navy, C.gold, 10)}
</g>`;
}

function qr(text: string, x: number, y: number, size: number) {
  const q = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = q.modules.size;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c)) d += `M${c},${r}h1v1h-1z`;
  const k = size / n;
  return `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="${C.paper}"/><path d="${d}" fill="${C.ink}" shape-rendering="crispEdges"/></g>`;
}

export const formatDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
export function formatLength(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}
/** "ai-devopseasylearning.com/certificates" from the full link. */
export function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.replace(/\/[^/]*$/, '')}`;
  } catch { return url; }
}

// ---------- layout ----------
export interface Rendered { svg: string; boxes: { what: string; x0: number; x1: number; y0: number; y1: number }[]; page: { w: number; h: number } }

export function renderCertificateSvg(data: CertificateData, paper: Paper = 'letter'): Rendered {
  const F = fonts();
  const { w: W, h: H } = PAGE[paper];
  const boxes: Rendered['boxes'] = [];
  const parts: string[] = [];
  const cx = W / 2;
  const add = (what: string, r: ReturnType<typeof line>, y: number, size: number) => { parts.push(r.svg); boxes.push({ what, x0: r.x0, x1: r.x1, y0: y - size * 0.8, y1: y + size * 0.25 }); };

  // Frame: outer navy rule, inner hairline, gold corners, a faint diagonal weave.
  const o = 30, i = 42;
  const corner = (x: number, y: number, dx: number, dy: number) => `<path d="M${x},${y + dy * 46} L${x},${y} L${x + dx * 46},${y}" fill="none" stroke="${C.gold}" stroke-width="3"/>`;
  parts.push(`<rect width="${W}" height="${H}" fill="${C.paper}"/>
<defs><pattern id="weave" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="9" fill="${C.navy}" fill-opacity="0.025"/></pattern></defs>
<rect x="${i}" y="${i}" width="${W - 2 * i}" height="${H - 2 * i}" fill="url(#weave)"/>
<rect x="${o}" y="${o}" width="${W - 2 * o}" height="${H - 2 * o}" fill="none" stroke="${C.navy}" stroke-width="2"/>
<rect x="${i}" y="${i}" width="${W - 2 * i}" height="${H - 2 * i}" fill="none" stroke="${C.navy}" stroke-width="1"/>
${corner(o - 7, o - 7, 1, 1)}${corner(W - o + 7, o - 7, -1, 1)}${corner(o - 7, H - o + 7, 1, -1)}${corner(W - o + 7, H - o + 7, -1, -1)}`);

  const top = i + (paper === 'a4' ? 36 : 44);
  const bottom = H - i - 38;
  const contentW = W - 2 * (i + 90);

  // Brand (top): the DEL loop and the name in small capitals.
  parts.push(loop(cx - 28, top, 56, C.violet, C.cyan));
  const brandY = top + 28 + 6 + 13;
  add('brand', line({ font: F.sans, size: 15, spacing: 0.04 }, ISSUER.toUpperCase(), cx, brandY, C.navy), brandY, 15);

  // Footer (bottom): signature left, seal centre, verification right.
  const sealR = paper === 'a4' ? 46 : 52;
  const sealCy = bottom - sealR - 2;
  parts.push(seal(cx, sealCy, sealR));
  boxes.push({ what: 'seal', x0: cx - sealR - 5, x1: cx + sealR + 5, y0: sealCy - sealR - 5, y1: sealCy + sealR + 5 });
  const left = i + 90 - 70;
  const sigLineY = bottom - 40;
  add('sig-lead', line({ font: F.italic, size: 15 }, SIGNATURE.lead, left + 20, sigLineY - 14, C.muted, 'start'), sigLineY - 14, 15);
  parts.push(`<line x1="${left + 20}" y1="${sigLineY}" x2="${left + 260}" y2="${sigLineY}" stroke="${C.ink}" stroke-width="1"/>`);
  add('sig-title', line({ font: F.medium, size: 17 }, SIGNATURE.title, left + 20, sigLineY + 21, C.ink, 'start'), sigLineY + 21, 17);
  add('sig-org', line({ font: F.regular, size: 15 }, SIGNATURE.org, left + 20, sigLineY + 39, C.muted, 'start'), sigLineY + 39, 15);
  const qrSize = 86;
  const right = W - left - 20;
  const qrX = right - qrSize;
  const qrY = bottom - qrSize;
  parts.push(qr(data.url, qrX, qrY, qrSize));
  boxes.push({ what: 'qr', x0: qrX, x1: qrX + qrSize, y0: qrY, y1: qrY + qrSize });
  const vx = qrX - 14;
  add('ver-label', line({ font: F.italic, size: 14 }, 'Verify this certificate', vx, bottom - 50, C.muted, 'end'), bottom - 50, 14);
  add('ver-id', line({ font: F.semibold, size: 17 }, data.code, vx, bottom - 30, C.ink, 'end'), bottom - 30, 17);
  add('ver-url', line({ font: F.regular, size: 14 }, shortUrl(data.url), vx, bottom - 12, C.muted, 'end'), bottom - 12, 14);

  // Main block, vertically centred between the brand and the footer.
  const name = fit(F.medium, data.name, contentW - 40, 60, 40, 32);
  const course = fit(F.semibold, data.course, contentW - 20, 30, 24, 20);
  const meta = `on ${formatDate(data.issuedAt)}${data.durationSec > 0 ? ` · ${formatLength(data.durationSec)} of instruction` : ''}`;
  const lh = (s: number) => Math.round(s * 1.12);
  const blocks: { h: number; draw: (y: number) => void }[] = [
    { h: 44, draw: (y) => add('title', line({ font: F.medium, size: 44, spacing: 0.03 }, 'Certificate of Completion', cx, y + 34, C.navy), y + 34, 44) },
    { h: 14, draw: () => undefined },
    { h: 24, draw: (y) => add('pre', line({ font: F.italic, size: 21 }, 'is hereby presented to', cx, y + 17, C.muted), y + 17, 21) },
    { h: 8, draw: () => undefined },
    {
      h: lh(name.size) * name.lines.length + 12,
      draw: (y) => {
        name.lines.forEach((t, k) => add('name', line({ font: F.medium, size: name.size }, t, cx, y + name.size * 0.86 + k * lh(name.size), C.ink), y + name.size * 0.86 + k * lh(name.size), name.size));
        const widest = Math.max(...name.lines.map((t) => textWidth({ font: F.medium, size: name.size }, t)));
        const ul = Math.min(contentW, widest + 80);
        const uy = y + lh(name.size) * name.lines.length + 8;
        parts.push(`<line x1="${cx - ul / 2}" y1="${uy}" x2="${cx + ul / 2}" y2="${uy}" stroke="${C.gold}" stroke-width="1"/>`);
      },
    },
    { h: 16, draw: () => undefined },
    { h: 22, draw: (y) => add('stmt', line({ font: F.italic, size: 20 }, 'for successfully completing the course', cx, y + 16, C.muted), y + 16, 20) },
    { h: 8, draw: () => undefined },
    { h: lh(course.size) * course.lines.length, draw: (y) => course.lines.forEach((t, k) => add('course', line({ font: F.semibold, size: course.size }, t, cx, y + course.size * 0.86 + k * lh(course.size), C.navy), y + course.size * 0.86 + k * lh(course.size), course.size)) },
    { h: 12, draw: () => undefined },
    { h: 20, draw: (y) => add('meta', line({ font: F.regular, size: 18 }, meta, cx, y + 15, C.muted), y + 15, 18) },
  ];
  const mainH = blocks.reduce((n, b) => n + b.h, 0);
  const areaTop = brandY + 10;
  const areaBottom = sealCy - sealR - 8;
  let y = areaTop + Math.max(0, (areaBottom - areaTop - mainH) / 2);
  for (const b of blocks) { b.draw(y); y += b.h; }

  if (data.revoked) {
    const r = { font: F.semibold, size: 120, spacing: 0.1 };
    const t = line(r, 'REVOKED', 0, 0, C.red);
    parts.push(`<g transform="translate(${cx} ${H / 2 + 40}) rotate(-24)" opacity="0.78"><rect x="${t.x0 - 30}" y="-118" width="${t.w + 60}" height="150" fill="none" stroke="${C.red}" stroke-width="8"/>${t.svg}</g>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`Certificate of Completion: ${data.name}, ${data.course}, ${data.code}`)}">${parts.join('\n')}</svg>`;
  return { svg, boxes, page: { w: W, h: H } };
}

/** 300 dpi PNG of the certificate (3300 px wide for Letter, 3508 for A4). */
export function renderCertificatePng(svg: string, paper: Paper = 'letter') {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: PAGE[paper].pxW }, font: { loadSystemFonts: false }, background: C.paper }).render();
  return { png: img.asPng(), width: img.width, height: img.height, pixels: img.pixels };
}

/** One-page PDF of the exact paper size with the 300 dpi image (no extra libraries; FlateDecode RGB). */
export function renderCertificatePdf(svg: string, paper: Paper = 'letter', title = 'Certificate of Completion') {
  const { width, height, pixels } = renderCertificatePng(svg, paper);
  const rgb = Buffer.alloc(width * height * 3);
  for (let p = 0, q = 0; p < pixels.length; p += 4, q += 3) { rgb[q] = pixels[p]!; rgb[q + 1] = pixels[p + 1]!; rgb[q + 2] = pixels[p + 2]!; }
  const img = deflateSync(rgb, { level: 6 });
  const { ptW, ptH } = PAGE[paper];
  const content = Buffer.from(`q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`);
  const pdfStr = (s: string) => `(${s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?')})`;
  const objs: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>\nstream\n`), img, Buffer.from('\nendstream')]),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]),
    Buffer.from(`<< /Title ${pdfStr(title)} /Author ${pdfStr(ISSUER)} /Creator ${pdfStr(`${ISSUER} certificates ${RENDER_VERSION}`)} >>`),
  ];
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  let off = chunks[0]!.length;
  const xref: number[] = [];
  objs.forEach((o, k) => {
    xref.push(off);
    const b = Buffer.concat([Buffer.from(`${k + 1} 0 obj\n`), o, Buffer.from('\nendobj\n')]);
    chunks.push(b);
    off += b.length;
  });
  const xrefStart = off;
  chunks.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map((x) => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
