import { Resvg } from '@resvg/resvg-js';
import type * as opentype from 'opentype.js';
import sharp from 'sharp';
import { contrast, esc, fitTitle, fonts, LOOP, motifSvg, readableAccent, splitTitle, textWidth, type Box } from '../covers/cover-render';
import type { Motif, Palette } from '../covers/cover-templates';
import type { Family, ShareSymbol, ShareTemplate } from './share-templates';

/**
 * Sharing banner renderer (docs/SOCIAL_SHARING.md). Draws a 1200×630 SVG in the DEL font (Schibsted Grotesk, measured
 * with its real metrics so text never runs out of its column) and encodes it as a JPEG under 300 KB (PNG if smaller).
 * Three families, the owner's designs 3, 4 and 1 (share-templates.ts). Every text sits inside SAFE, the area that
 * survives the crops link previews make; `bannerSvg` returns the boxes it drew so the tests can check that.
 */

export const SHARE_W = 1200;
export const SHARE_H = 630;
export const MAX_BYTES = 300 * 1024;
/** Text and logos stay inside this box (60 px from the sides, 30 px from the top and bottom). */
export const SAFE = { x: 60, y: 30, w: 1080, h: 570 };
const FAMILY = 'Schibsted Grotesk';
const SITE_HOST = 'ai-devopseasylearning.com';

export interface ShareCard { title: string; line: string; accent: string; free?: boolean }
export interface SharePanel { symbol: ShareSymbol | 'certificate'; a: string; b: string; title: string; line: string }

export interface BannerInput {
  family: Family;
  template: ShareTemplate;
  /** "Title: Subtitle" is split into a main line and an accent line; "\n" sets the lines yourself. */
  headline: string;
  subline?: string | null;
  cta: string;
  topic?: string | null;
  free?: boolean;
  /** pro: the two panels on the right (course: topic + certificate; site: from the settings). */
  panels?: SharePanel[];
  /** marketplace: real published courses; on a course banner the first card is the course itself. */
  cards?: ShareCard[];
  /** marketplace: true when the first card is this course (drawn in front, larger). */
  courseCard?: boolean;
  /** enterprise: short topic chips. */
  chips?: string[];
  /** enterprise: draw the template's symbol on the right (course banners). */
  symbol?: boolean;
}

export interface DrawnBox { x: number; y: number; w: number; h: number; what: string }

// ---------- colour helpers ----------
const hexOf = (n: number[]) => '#' + n.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** `hex` mixed toward `to` by t (0..1). */
export const mix = (hex: string, to: string, t: number) => { const a = rgb(hex); const b = rgb(to); return hexOf(a.map((v, i) => v * (1 - t) + b[i]! * t)); };
/** The accent lightened until text in it reads at 4.5:1 on a dark ground. */
export function lightAccent(accent: string, ground: string): string {
  for (let k = 0; k <= 20; k++) { const c = mix(accent, '#ffffff', k / 20); if (contrast(c, ground) >= 4.5) return c; }
  return '#ffffff';
}

// ---------- text ----------
/** Greedy wrap into at most `n` lines; the last one ends with "…" when text is left over. */
function clampLines(font: opentype.Font, text: string, size: number, maxW: number, n: number): string[] {
  const out: string[] = [];
  let line = '';
  const words = text.split(/\s+/).filter(Boolean);
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (tw(font, next, size) <= maxW) { line = next; continue; }
    if (out.length === n - 1) break;
    out.push(line || words[i]!);
    line = line ? words[i]! : '';
  }
  const rest = i < words.length;
  if (line) out.push(rest ? ellipsis(font, `${line} ${words.slice(i).join(' ')}`, size, maxW) : line);
  return out.slice(0, n);
}

interface Ctx { boxes: DrawnBox[] }
function capOf(font: opentype.Font) {
  return ((font.tables.os2 as { sCapHeight?: number } | undefined)?.sCapHeight ?? font.ascender * 0.7) / font.unitsPerEm;
}
const TRACK = -0.02;
const tw = (font: opentype.Font, s: string, size: number, track = 0) => textWidth(font, s, size) + (track - TRACK) * size * Math.max(0, s.length - 1);

/** Words wrapped to `maxW` at `size`, or null when they need more than `maxLines` lines (or a word is too wide). */
function wrapAt(font: opentype.Font, text: string, size: number, maxW: number, maxLines: number): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (tw(font, w, size) > maxW) return null;
    const next = line ? `${line} ${w}` : w;
    if (tw(font, next, size) <= maxW) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length <= maxLines ? lines : null;
}

/** One line, shortened with "…" at a word when it does not fit. */
function ellipsis(font: opentype.Font, text: string, size: number, maxW: number): string {
  let t = text.replace(/\s+/g, ' ').trim();
  if (tw(font, t, size) <= maxW) return t;
  while (t && tw(font, `${t}…`, size) > maxW) t = t.includes(' ') ? t.replace(/\s*\S+$/, '') : t.slice(0, -1);
  return `${t.replace(/[,.;:\s·-]+$/, '')}…`;
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, weight: 600 | 700 | 800, fill: string, o: { anchor?: 'start' | 'end' | 'middle'; track?: number; what?: string; record?: boolean } = {}) {
  const f = weight === 800 ? fonts().title : fonts().label;
  const w = tw(f, s, size, o.track ?? 0);
  const x0 = o.anchor === 'end' ? x - w : o.anchor === 'middle' ? x - w / 2 : x;
  if (o.record !== false) ctx.boxes.push({ x: x0, y: y - capOf(f) * size, w, h: (capOf(f) + 0.24) * size, what: o.what ?? s });
  const ls = o.track ? ` letter-spacing="${o.track * size}"` : weight === 800 ? ` letter-spacing="${TRACK * size}"` : '';
  return `<text x="${r(x)}" y="${r(y)}"${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''} font-family="${FAMILY}" font-weight="${weight}" font-size="${size}"${ls} fill="${fill}">${esc(s)}</text>`;
}
const r = (n: number) => Math.round(n * 10) / 10;

/** Pill with a label: returns its svg and width. */
function pill(ctx: Ctx, label: string, x: number, y: number, o: { size: number; h: number; pad: number; fill: string; fg: string; stroke?: string; track?: number; weight?: 700 | 800; fillOpacity?: number }) {
  const f = o.weight === 800 ? fonts().title : fonts().label;
  const w = tw(f, label, o.size, o.track ?? 0) + o.pad * 2;
  const svg = `<rect x="${r(x)}" y="${y}" width="${r(w)}" height="${o.h}" rx="${o.h / 2}" fill="${o.fill}"${o.fillOpacity !== undefined ? ` fill-opacity="${o.fillOpacity}"` : ''}${o.stroke ? ` stroke="${o.stroke}" stroke-width="2"` : ''}/>` +
    text(ctx, label, x + o.pad, y + o.h / 2 + capOf(f) * o.size / 2, o.size, o.weight ?? 700, o.fg, { track: o.track, what: label });
  return { svg, w };
}

function cta(ctx: Ctx, label: string, x: number, y: number, bg: string, fg: string) {
  return pill(ctx, `${label}  →`, x, y, { size: 23, h: 60, pad: 32, fill: bg, fg, weight: 800 }).svg;
}

/** The DEL mark: the two-colour loop and the name (prototype DEL(), scale .78 → 94 px wide loop). */
function delMark(ctx: Ctx, x: number, y: number, ink: string) {
  const s = 0.78;
  ctx.boxes.push({ x, y, w: 120 * s, h: 60 * s, what: 'DEL mark' });
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke-linecap="round" stroke-width="10"><path d="M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30" stroke="#7b6cf0"/><path d="M60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30" stroke="#3db1ec"/></g>` +
    text(ctx, 'DevOps Easy Learning', x + 132 * s, y + 41 * s, 30 * s, 800, ink, { what: 'DEL name' });
}

// ---------- the headline column ----------
interface Line { s: string; size: number; weight: 600 | 700 | 800; fill: string }
interface ColumnSpec {
  x: number; w: number; top: number; bottom: number;
  headline: string; subline?: string | null;
  ink: string; accentInk: string; subInk: string;
  /** Size range of the main headline; the accent line of a "Title: Subtitle" split is `accentScale` of it. */
  max: number; min: number; accentScale: number; subSize: number;
  /** Colour the last explicit line in the accent (designs 3 and 4), or every line after the first. */
  accentLast?: boolean;
}

/** Fits the headline (+ accent line) and the supporting line into the column, largest first; drops the support line before going small. */
function column(ctx: Ctx, c: ColumnSpec): string {
  const T = fonts().title;
  const L = fonts().label;
  const explicit = c.headline.includes('\n');
  const parts = explicit ? null : splitTitle(c.headline);
  const rawLines = explicit ? c.headline.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3) : null;
  const sub = (c.subline ?? '').replace(/\s+/g, ' ').trim();

  const attempt = (size: number, subLines: number): Line[][] | null => {
    const blocks: Line[][] = [];
    if (rawLines) {
      const out: Line[] = [];
      for (let i = 0; i < rawLines.length; i++) {
        const ls = wrapAt(T, rawLines[i]!, size, c.w, 1);
        if (!ls) return null;
        out.push({ s: ls[0]!, size, weight: 800, fill: (c.accentLast ? i === rawLines.length - 1 : i > 0) && rawLines.length > 1 ? c.accentInk : c.ink });
      }
      blocks.push(out);
    } else {
      const main = wrapAt(T, parts!.main, size, c.w, parts!.sub ? 2 : 3);
      if (!main) return null;
      blocks.push(main.map((s) => ({ s, size, weight: 800, fill: c.ink })));
      if (parts!.sub) {
        const as = Math.max(26, Math.round(size * c.accentScale));
        const acc = wrapAt(T, parts!.sub, as, c.w, 2) ?? (wrapAt(T, parts!.sub, 26, c.w, 2) ? null : clampLines(T, parts!.sub, as, c.w, 2));
        if (!acc) return null;
        blocks.push(acc.map((s) => ({ s, size: as, weight: 800, fill: c.accentInk })));
      }
    }
    if (sub && subLines) {
      const sl = wrapAt(L, sub, c.subSize, c.w, subLines);
      if (sl) blocks.push(sl.map((s) => ({ s, size: c.subSize, weight: 600, fill: c.subInk })));
      else blocks.push(clampLines(L, sub, c.subSize, c.w, subLines).map((s) => ({ s, size: c.subSize, weight: 600 as const, fill: c.subInk })));
    }
    return blocks;
  };

  const layout = (blocks: Line[][]) => {
    const out: { line: Line; y: number }[] = [];
    let y = c.top;
    blocks.forEach((b, bi) => {
      b.forEach((line, li) => {
        const f = line.weight === 800 ? T : L;
        if (!out.length) y = c.top + capOf(f) * line.size;
        else if (li === 0) y += bi === blocks.length - 1 && line.weight === 600 ? line.size * 2.05 : line.size * 1.18;
        else y += line.weight === 600 ? line.size * 1.38 : line.size * 1.14;
        out.push({ line, y });
      });
    });
    const last = out[out.length - 1]!;
    return { out, bottom: last.y + last.line.size * 0.24 };
  };

  // Largest headline first, keeping two (then one) supporting lines; the supporting line is dropped only as a last resort.
  for (const tries of sub ? [[2, 1], [0]] : [[0]]) {
    for (let size = c.max; size >= c.min; size -= 2) {
      for (const subLines of tries) {
        const b = attempt(size, subLines!);
        if (!b) continue;
        const l = layout(b);
        if (l.bottom <= c.bottom) return l.out.map(({ line, y }) => text(ctx, line.s, c.x, y, line.size, line.weight, line.fill, { what: 'headline' })).join('');
      }
    }
  }
  // Very long headline: the smallest size, two lines, ellipsed (fitTitle handles single long words).
  const t = fitTitle(parts?.main ?? c.headline.replace(/\n/g, ' '), c.w, 2, c.min, c.min - 8);
  const y0 = c.top + capOf(T) * t.size;
  return t.lines.map((s, i) => text(ctx, s, c.x, y0 + i * t.lineHeight, t.size, 800, c.ink, { what: 'headline' })).join('');
}

// ---------- symbols (original drawings in ±100 units, as the cover motifs) ----------
function symbolSvg(sym: ShareSymbol | 'certificate', box: Box, a: string, b: string, ground: string): string {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const u = Math.min(box.w, box.h);
  const s = u / 266;
  const g = (inner: string, scale = s) => `<g transform="translate(${r(cx)} ${r(cy)}) scale(${r(scale * 1000) / 1000})">${inner}</g>`;
  const palette: Palette = { bg: [ground, ground], ink: '#ffffff', a, b, tone: 'dark' };
  switch (sym) {
    case 'tf-blocks': {
      // a configuration file, an arrow, and the three infrastructure blocks it creates
      const lines = [[-40, 50], [-22, 36], [-4, 46], [14, 30]].map(([y, w]) => `<rect x="-80" y="${y}" width="${w}" height="8" rx="4" fill="${b}"/>`).join('');
      const blocks = [0, 1, 2].map((i) => `<rect x="34" y="${-66 + i * 46}" width="66" height="36" rx="8" fill="${a}" fill-opacity="${1 - i * 0.22}"/><circle cx="48" cy="${-48 + i * 46}" r="5" fill="${ground}"/>`).join('');
      return g(`<rect x="-98" y="-62" width="86" height="118" rx="12" fill="${ground}" stroke="${a}" stroke-width="6"/>${lines}<path d="M-2,-4 h24 m-11,-11 l11,11 l-11,11" fill="none" stroke="${b}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${blocks}`);
    }
    case 'k8s-wheel': {
      // a ring with six spokes and six pods on the rim: an orchestrated cluster (not the Kubernetes logo)
      let spokes = '';
      let pods = '';
      for (let i = 0; i < 6; i++) {
        const t = (Math.PI / 3) * i - Math.PI / 2;
        spokes += `<line x1="${r(Math.cos(t) * 20)}" y1="${r(Math.sin(t) * 20)}" x2="${r(Math.cos(t) * 70)}" y2="${r(Math.sin(t) * 70)}" stroke="${a}" stroke-width="7" stroke-linecap="round"/>`;
        pods += `<rect x="${r(Math.cos(t) * 74 - 12)}" y="${r(Math.sin(t) * 74 - 12)}" width="24" height="24" rx="6" fill="${b}" stroke="${ground}" stroke-width="4"/>`;
      }
      return g(`<circle r="74" fill="${a}" fill-opacity="0.12" stroke="${a}" stroke-width="7"/>${spokes}<circle r="20" fill="${a}"/><circle r="8" fill="${ground}"/>${pods}`);
    }
    case 'shield-lock':
      return g(`<path d="M0,-84 L68,-58 V0 C68,46 36,74 0,88 C-36,74 -68,46 -68,0 V-58 Z" fill="${a}" fill-opacity="0.14" stroke="${a}" stroke-width="7" stroke-linejoin="round"/><path d="M-15,-4 v-16 a15,15 0 0 1 30,0 v16" fill="none" stroke="${b}" stroke-width="7"/><rect x="-28" y="-6" width="56" height="44" rx="9" fill="${a}"/><circle cx="0" cy="12" r="6" fill="${ground}"/><rect x="-2.5" y="12" width="5" height="14" fill="${ground}"/>`);
    case 'brackets':
      return g(`<path d="M-42,-52 L-92,0 L-42,52 M42,-52 L92,0 L42,52" fill="none" stroke="${a}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M20,-66 L-20,66" stroke="${b}" stroke-width="13" stroke-linecap="round"/>`);
    case 'spark': {
      const star = 'M0,-80 C8,-20 20,-8 80,0 C20,8 8,20 0,80 C-8,20 -20,8 -80,0 C-20,-8 -8,-20 0,-80Z';
      return g(`<path d="${star}" fill="${a}"/><path d="${star}" fill="${b}" transform="translate(64 -58) scale(0.3)"/><path d="${star}" fill="${b}" transform="translate(-66 58) scale(0.22)"/>`);
    }
    case 'certificate': {
      const lines = [[-58, -26, 70], [-58, -8, 96], [-58, 10, 56]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="8" rx="4" fill="${b}" fill-opacity="0.55"/>`).join('');
      return g(`<rect x="-80" y="-62" width="160" height="112" rx="12" fill="#ffffff" stroke="${a}" stroke-width="6"/>${lines}<path d="M34,52 l-10,34 l18,-10 l18,10 l-10,-34" fill="${a}"/><circle cx="42" cy="40" r="26" fill="#f1d58a" stroke="#a7822f" stroke-width="4"/><path d="M31,40 l8,8 l15,-16" fill="none" stroke="#5a430f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    case 'loop':
      return motifSvg('loop', { x: box.x + box.w * 0.08, y: box.y, w: box.w * 0.84, h: box.h }, palette);
    default:
      return motifSvg(sym as Motif, box, palette);
  }
}

function freeBadge(ctx: Ctx, x: number, y: number, dark: boolean) {
  return pill(ctx, 'FREE COURSE', x, y, { size: 17, h: 40, pad: 18, fill: dark ? '#3fcf92' : '#0f7a4f', fg: dark ? '#0b1030' : '#ffffff', weight: 800, track: 0.08 });
}

/** The topic label and the free badge on one row; returns the svg. */
function labelRow(ctx: Ctx, x: number, y: number, topic: string | null | undefined, free: boolean | undefined, look: { fill: string; fg: string; stroke: string; fillOpacity?: number; dark: boolean }) {
  let out = '';
  let cx = x;
  if (topic) {
    const p = pill(ctx, ellipsis(fonts().label, topic, 20, 380), cx, y, { size: 20, h: 40, pad: 18, fill: look.fill, fg: look.fg, stroke: look.stroke, fillOpacity: look.fillOpacity });
    out += p.svg;
    cx += p.w + 12;
  }
  if (free) out += freeBadge(ctx, cx, y, look.dark).svg;
  return out;
}

// ---------- family: pro (design 3) ----------
function proSvg(ctx: Ctx, i: BannerInput): string {
  const t = i.template;
  const course = !!i.topic || i.free !== undefined;
  const tintBg = mix(t.a, '#ffffff', 0.86);
  const label = course ? labelRow(ctx, 70, 128, i.topic, i.free, { fill: tintBg, fg: readableAccent(t.a, tintBg), stroke: mix(t.a, '#ffffff', 0.5), dark: false }) : '';
  const head = column(ctx, {
    x: 70, w: 650, top: course ? 196 : 176, bottom: 438, headline: i.headline, subline: i.subline,
    ink: '#141833', accentInk: '#4f3fb0', subInk: '#3c4263', max: 70, min: 40, accentScale: course ? 0.7 : 1, subSize: 26,
  });
  const panels = (i.panels ?? []).slice(0, 2).map((p, n) => {
    const y = 130 + n * 200;
    const L = fonts().label;
    const T = fonts().title;
    const name = wrapAt(T, p.title, 34, 214, 1) ? { lines: [p.title], size: 34 } : fitTitle(p.title, 214, 2, 30, 20);
    const line = wrapAt(L, p.line, 18, 214, 2) ?? clampLines(L, p.line, 18, 214, 2);
    const nameH = (name.lines.length - 1) * name.size * 1.1 + capOf(T) * name.size;
    const blockH = nameH + 14 + capOf(L) * 18 + (line.length - 1) * 24;
    let y0 = y + (170 - blockH) / 2 + capOf(T) * name.size;
    let svg = '';
    name.lines.forEach((s, k) => { svg += text(ctx, s, 900, y0 + k * name.size * 1.1, name.size, 800, '#14213d', { what: 'panel title' }); });
    y0 += (name.lines.length - 1) * name.size * 1.1 + 14 + capOf(L) * 18;
    line.forEach((s, k) => { svg += text(ctx, s, 900, y0 + k * 24, 18, 600, '#4c5573', { what: 'panel line' }); });
    return `<rect x="760" y="${y}" width="370" height="170" rx="22" fill="#ffffff" stroke="${mix(p.a, '#ffffff', 0.58)}" stroke-width="3"/>${symbolSvg(p.symbol, { x: 774, y: y + 22, w: 116, h: 126 }, p.a, p.b, '#ffffff')}${svg}`;
  }).join('');
  return `<defs><linearGradient id="bg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#eaf4ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient></defs>
<rect width="${SHARE_W}" height="${SHARE_H}" fill="url(#bg)"/>
${panels}
${delMark(ctx, 70, 58, '#141833')}
${label}${head}
${cta(ctx, i.cta, 70, 466, '#4f3fb0', '#ffffff')}
${text(ctx, SITE_HOST, 70, 590, 22, 600, '#525b7a', { what: 'url' })}`;
}

// ---------- family: marketplace (design 4) ----------
function card(ctx: Ctx, c: ShareCard, x: number, y: number, rot: number, w: number, h: number, front: boolean) {
  const T = fonts().title;
  const L = fonts().label;
  const inner = w - 40;
  let title = wrapAt(T, c.title, front ? 28 : 26, inner, 1);
  let size = front ? 28 : 26;
  if (!title) for (size = front ? 25 : 22; size >= 16; size -= 1) { title = wrapAt(T, c.title, size, inner, 2); if (title) break; }
  if (!title) { size = 16; title = [ellipsis(T, c.title, 16, inner)]; }
  const lh = size * 1.12;
  const titleTop = 52 + capOf(T) * size;
  const lineY = titleTop + (title.length - 1) * lh + (front ? 36 : 32);
  const sub = { boxes: [] } as Ctx; // card text is inside a rotated group: the card rectangle is recorded instead
  const body = title.map((s, k) => text(sub, s, 20, titleTop + k * lh, size, 800, '#ffffff')).join('') + text(sub, ellipsis(L, c.line, 18, inner), 20, Math.min(lineY, h - 20), 18, 600, '#c3c7e8');
  const free = c.free ? `<rect x="${w - 92}" y="16" width="72" height="26" rx="13" fill="#3fcf92"/><text x="${w - 56}" y="34" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="13" letter-spacing="1" fill="#0b1030">FREE</text>` : '';
  const rad = (Math.abs(rot) * Math.PI) / 180;
  ctx.boxes.push({ x: x - h * Math.sin(rad), y, w: w * Math.cos(rad) + h * Math.sin(rad), h: h * Math.cos(rad) + w * Math.sin(rad), what: `card ${c.title}` });
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect width="${w}" height="${h}" rx="18" fill="#141834" stroke="${c.accent}" stroke-width="${front ? 3.5 : 2.5}"/><rect x="20" y="22" width="64" height="8" rx="4" fill="${c.accent}"/>${free}${body}</g>`;
}

function seal(ctx: Ctx, x: number, y: number) {
  ctx.boxes.push({ x: x - 56, y: y - 56, w: 112, h: 112, what: 'seal' });
  return `<g transform="translate(${x} ${y})"><circle r="56" fill="#f1d58a"/><circle r="44" fill="none" stroke="#a7822f" stroke-width="2"/><text y="-4" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="15" fill="#5a430f">VERIFIED</text><text y="16" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="13" fill="#5a430f">CERTIFICATE</text></g>`;
}

function marketplaceSvg(ctx: Ctx, i: BannerInput): string {
  const t = i.template;
  const course = !!i.topic || i.free !== undefined;
  const cards = (i.cards ?? []).slice(0, 3);
  let right = '';
  if (i.courseCard && cards.length) {
    const [self, ...others] = cards;
    // related courses behind, this course in front
    if (others[0]) right += card(ctx, others[0], 810, 62, 4, 320, 140, false);
    if (others[1]) right += card(ctx, others[1], 812, 418, -3, 320, 140, false);
    right += card(ctx, self!, 742, others.length ? 214 : 200, -2, 380, 186, true);
  } else {
    const pos: [number, number, number][] = [[790, 62, 4], [760, 236, -3], [800, 410, 2]];
    cards.forEach((c, n) => { right += card(ctx, c, pos[n]![0], pos[n]![1], pos[n]![2], 330, 150, false); });
  }
  const label = course ? labelRow(ctx, 70, 128, i.topic, i.free, { fill: lightAccent(t.a, '#2a1f72'), fillOpacity: 0.18, fg: lightAccent(t.b, '#3a2c8f'), stroke: lightAccent(t.a, '#2a1f72'), dark: true }) : '';
  const head = column(ctx, {
    x: 70, w: 590, top: course ? 196 : 162, bottom: 432, headline: i.headline, subline: i.subline,
    ink: '#ffffff', accentInk: '#ffd27a', subInk: '#e6e2fd', max: course ? 62 : 60, min: 36, accentScale: course ? 0.68 : 1, subSize: 25, accentLast: true,
  });
  return `<defs><linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="#2a1f72"/><stop offset="1" stop-color="#4f3fb0"/></linearGradient></defs>
<rect width="${SHARE_W}" height="${SHARE_H}" fill="url(#bg)"/>
${right}
${seal(ctx, 690, 486)}
${delMark(ctx, 70, 58, '#ffffff')}
${label}${head}
${cta(ctx, i.cta, 70, 456, '#ffd27a', '#2a1f72')}
${text(ctx, SITE_HOST, 70, 590, 22, 600, '#ddd8fb', { what: 'url' })}`;
}

// ---------- family: enterprise (design 1, the night-blueprint covers' family) ----------
function enterpriseSvg(ctx: Ctx, i: BannerInput): string {
  const t = i.template;
  const course = !!i.topic || i.free !== undefined;
  const ground = '#0b1030';
  const glow = course ? t.a : '#6f5fe0';
  const line = course ? t.a : '#3db1ec';
  const sym = i.symbol ? symbolSvg(t.symbol, { x: 850, y: 150, w: 290, h: 290 }, t.a, t.b, ground) : '';
  const colW = i.symbol ? 740 : 980;
  const label = course ? labelRow(ctx, 70, 128, i.topic, i.free, { fill: t.a, fillOpacity: 0.16, fg: lightAccent(t.b, ground), stroke: t.a, dark: true }) : '';
  const chips = (i.chips ?? []).map((c) => c.trim()).filter(Boolean);
  const hasChips = chips.length > 0;
  const head = column(ctx, {
    x: 70, w: colW, top: course ? 196 : 176, bottom: hasChips ? 396 : 438, headline: i.headline, subline: i.subline,
    ink: '#ffffff', accentInk: lightAccent(t.b, ground), subInk: '#cfd3f2', max: course ? 70 : 78, min: 38, accentScale: course ? 0.66 : 1, subSize: 26,
  });
  let chipSvg = '';
  let cx = 70;
  for (const c of chips.slice(0, 5)) {
    const L = fonts().label;
    const w = tw(L, c, 18) + 34;
    if (cx + w > 70 + colW) break;
    chipSvg += pill(ctx, c, cx, 418, { size: 18, h: 40, pad: 17, fill: '#ffffff', fillOpacity: 0.06, fg: '#e3e6ff', stroke: '#8c80f0' }).svg;
    cx += w + 10;
  }
  return `<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern>
<radialGradient id="glow" cx="0.85" cy="0.42" r="0.55"><stop offset="0" stop-color="${glow}" stop-opacity="0.5"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient></defs>
<rect width="${SHARE_W}" height="${SHARE_H}" fill="${ground}"/><rect width="${SHARE_W}" height="${SHARE_H}" fill="url(#grid)"/><rect width="${SHARE_W}" height="${SHARE_H}" fill="url(#glow)"/>
<path d="M1200,120 H1040 l-36,36 H860 M1200,520 H1070 l-30,-30 H880" fill="none" stroke="${line}" stroke-width="3" opacity="0.7"/><circle cx="860" cy="156" r="7" fill="${line}"/><circle cx="880" cy="490" r="7" fill="${line}"/>
${sym}
${delMark(ctx, 70, 58, '#ffffff')}
${label}${head}${chipSvg}
${cta(ctx, i.cta, 70, hasChips ? 494 : 466, '#3db1ec', ground)}
${text(ctx, SITE_HOST, 1130, 590, 22, 600, '#a3a9d4', { anchor: 'end', what: 'url' })}`;
}

/** The banner as SVG, with the boxes of everything it wrote (for the safe-area test). */
export function bannerSvg(input: BannerInput): { svg: string; boxes: DrawnBox[] } {
  const ctx: Ctx = { boxes: [] };
  const body = input.family === 'marketplace' ? marketplaceSvg(ctx, input) : input.family === 'enterprise' ? enterpriseSvg(ctx, input) : proSvg(ctx, input);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_W}" height="${SHARE_H}" viewBox="0 0 ${SHARE_W} ${SHARE_H}">${body}</svg>`, boxes: ctx.boxes };
}

export interface EncodedImage { buf: Buffer; type: 'image/jpeg' | 'image/png'; ext: 'jpg' | 'png'; width: number; height: number }

/** Rasterise and encode: JPEG at the best quality that stays under 300 KB, or PNG when that is smaller still. */
export async function encodeBanner(svg: string, opts: { jpegOnly?: boolean } = {}): Promise<EncodedImage> {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: SHARE_W }, font: { fontFiles: fonts().files, loadSystemFonts: false, defaultFontFamily: FAMILY } }).render().asPng();
  return encodeRaster(png, opts);
}

export async function encodeRaster(input: Buffer, opts: { jpegOnly?: boolean } = {}): Promise<EncodedImage> {
  let jpg: Buffer | null = null;
  for (const q of [90, 86, 82, 76, 70, 62]) {
    jpg = await sharp(input).flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: q >= 86 ? '4:4:4' : '4:2:0' }).toBuffer();
    if (jpg.length <= MAX_BYTES) break;
  }
  if (!opts.jpegOnly) {
    const png = await sharp(input).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    if (png.length < jpg!.length && png.length <= MAX_BYTES) return { buf: png, type: 'image/png', ext: 'png', width: SHARE_W, height: SHARE_H };
  }
  return { buf: jpg!, type: 'image/jpeg', ext: 'jpg', width: SHARE_W, height: SHARE_H };
}

/** Render a banner to an encoded image. */
export async function bannerImage(input: BannerInput, opts: { jpegOnly?: boolean } = {}) {
  return encodeBanner(bannerSvg(input).svg, opts);
}

/** Ratio 1200:630 within 1 %, at least 1200 px wide. */
export const UPLOAD_RULES = { minWidth: 1200, ratio: SHARE_W / SHARE_H, maxBytes: 5 * 1024 * 1024 };

/**
 * A custom banner upload: any PNG/JPEG/WebP of 1200×630 (or larger at the same ratio), re-encoded at 1200×630 without
 * its metadata (EXIF, GPS, colour profiles, comments are dropped by the re-encode). Throws a readable message otherwise.
 */
export async function normaliseUpload(buf: Buffer): Promise<EncodedImage> {
  let meta: sharp.Metadata;
  try { meta = await sharp(buf).metadata(); } catch { throw new Error('That file is not an image we can read. Use PNG, JPG or WebP.'); }
  if (!meta.format || !['png', 'jpeg', 'webp'].includes(meta.format)) throw new Error('Use a PNG, JPG or WebP image.');
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < UPLOAD_RULES.minWidth || !h || Math.abs(w / h - UPLOAD_RULES.ratio) / UPLOAD_RULES.ratio > 0.01) throw new Error(`The banner must be 1200×630 px (or larger with the same shape); this one is ${w}×${h}.`);
  const raster = await sharp(buf).rotate().resize(SHARE_W, SHARE_H, { fit: 'cover' }).removeAlpha().png().toBuffer();
  return encodeRaster(raster);
}
