import { Resvg } from '@resvg/resvg-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as opentype from 'opentype.js';
import { type Layout, type Motif, type Palette } from './cover-templates';

/**
 * Server-side course cover renderer. A cover is drawn as SVG at 1280×720 from a template (layout + palette + motif) and the
 * course title, then rasterised to PNG with the site's own font (Schibsted Grotesk). Titles are measured with the real font
 * metrics, so size, line breaks and spacing are chosen to fit; a title never runs outside its box.
 */

export const COVER_W = 1280;
export const COVER_H = 720;
const M = 72;
const FAMILY = 'Schibsted Grotesk';

// ---------- fonts ----------
function fontDir() {
  for (const d of [join(__dirname, '..', '..', 'assets', 'fonts'), join(process.cwd(), 'assets', 'fonts'), join(process.cwd(), 'apps', 'api', 'assets', 'fonts')]) {
    if (existsSync(join(d, 'SchibstedGrotesk-800.ttf'))) return d;
  }
  throw new Error('Cover fonts not found (apps/api/assets/fonts)');
}
let cache: { files: string[]; title: opentype.Font; label: opentype.Font } | null = null;
export function fonts() {
  if (cache) return cache;
  const dir = fontDir();
  const files = ['600', '700', '800'].map((w) => join(dir, `SchibstedGrotesk-${w}.ttf`));
  const load = (f: string) => {
    const b = readFileSync(f);
    return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  };
  cache = { files, title: load(files[2]!), label: load(files[1]!) };
  return cache;
}

// ---------- text fitting ----------
const TRACK = -0.02; // letter-spacing in em, same as the site's display type
export function textWidth(font: opentype.Font, text: string, size: number) {
  return font.getAdvanceWidth(text, size, { kerning: true }) + TRACK * size * Math.max(0, text.length - 1);
}

function wrap(font: opentype.Font, words: string[], size: number, maxW: number): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (textWidth(font, w, size) > maxW) return null; // a single word too wide: needs a smaller size
    const next = line ? `${line} ${w}` : w;
    if (textWidth(font, next, size) <= maxW) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

export interface FittedTitle { size: number; lineHeight: number; lines: string[] }

/** Largest size (step 2px) at which the title fits `maxLines` lines of `maxW`; below `min`, the last line is shortened with "…". */
export function fitTitle(title: string, maxW: number, maxLines: number, max: number, min: number, font: opentype.Font = fonts().title): FittedTitle {
  const words = title.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) words.push('Untitled course');
  for (let size = max; size >= min; size -= 2) {
    const lines = wrap(font, words, size, maxW);
    if (lines && lines.length <= maxLines) return { size, lineHeight: Math.round(size * 1.06), lines };
  }
  // Very long titles: smallest size, words broken only if a single word is wider than the box, last line ellipsed.
  let size = min;
  while (size > 28 && words.some((w) => textWidth(font, w, size) > maxW)) size -= 2;
  const safe = words.map((w) => {
    let x = w;
    while (textWidth(font, x, size) > maxW && x.length > 1) x = x.slice(0, -1);
    return x === w ? w : `${x.slice(0, -1)}…`;
  });
  const lines = wrap(font, safe, size, maxW) ?? safe;
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last && textWidth(font, `${last}…`, size) > maxW) last = last.replace(/\s*\S+$/, '');
    kept[maxLines - 1] = `${last || kept[maxLines - 1]!.slice(0, 8)}…`;
    return { size, lineHeight: Math.round(size * 1.06), lines: kept };
  }
  return { size, lineHeight: Math.round(size * 1.06), lines };
}

// ---------- drawing helpers ----------
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const LOOP = 'M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30';
export interface Box { x: number; y: number; w: number; h: number }

/** Seeded pseudo-random numbers so a motif looks the same every time it is drawn. */
function rng(seed: number) {
  let s = (seed % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function motifSvg(m: Motif, b: Box, p: Palette): string {
  const { a, b: c } = p;
  let cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const u = Math.min(b.w, b.h);
  switch (m) {
    case 'loop': {
      const s = (b.w * 0.95) / 120;
      const ox = cx - 60 * s;
      const oy = cy - 30 * s;
      const echo = [0.55, 0.32, 0.16].map((o, i) => `<path d="${LOOP}" fill="none" stroke="${i % 2 ? c : a}" stroke-opacity="${o}" stroke-width="${(2.2 - i * 0.4) / 1}" transform="translate(${ox - i * 22} ${oy - i * 12}) scale(${s + i * 0.18})" stroke-linecap="round"/>`).join('');
      return `${echo}<path d="${LOOP}" fill="none" stroke="url(#acc)" stroke-width="${7 / 1}" stroke-linecap="round" transform="translate(${ox} ${oy}) scale(${s})"/>
        <circle cx="${ox + 41 * s}" cy="${oy + 13.2 * s}" r="${2.4 * s}" fill="${a}"/><circle cx="${ox + 79 * s}" cy="${oy + 46.8 * s}" r="${2.4 * s}" fill="${c}"/>`;
    }
    case 'pipeline': {
      const n = 5;
      const u = Math.min(b.h * 1.5, b.w * 0.9);
      const y = cy;
      const x0 = b.x + u * 0.08;
      const step = (b.w - u * 0.16) / (n - 1);
      let out = `<line x1="${x0}" y1="${y}" x2="${x0 + step * (n - 1)}" y2="${y}" stroke="url(#acc)" stroke-width="${u * 0.035}" stroke-linecap="round"/>`;
      for (let i = 0; i < n; i++) {
        const x = x0 + step * i;
        const r = u * (i === n - 1 ? 0.075 : 0.055);
        out += `<circle cx="${x}" cy="${y}" r="${r + u * 0.03}" fill="${i < 3 ? a : c}" fill-opacity="0.18"/><circle cx="${x}" cy="${y}" r="${r}" fill="${p.bg[0]}" stroke="${i < 3 ? a : c}" stroke-width="${u * 0.022}"/>`;
        if (i === n - 1) out += `<path d="M${x - r * 0.45} ${y} l${r * 0.3} ${r * 0.32} l${r * 0.55} ${-r * 0.62}" fill="none" stroke="${c}" stroke-width="${u * 0.022}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      // branch lines above and below: build and deploy lanes
      out += `<path d="M${x0 + step} ${y} C${x0 + step * 1.4} ${y - u * 0.3}, ${x0 + step * 2.6} ${y - u * 0.3}, ${x0 + step * 3} ${y}" fill="none" stroke="${a}" stroke-opacity="0.45" stroke-width="${u * 0.014}" stroke-dasharray="${u * 0.03} ${u * 0.025}"/>`;
      out += `<path d="M${x0 + step} ${y} C${x0 + step * 1.4} ${y + u * 0.3}, ${x0 + step * 2.6} ${y + u * 0.3}, ${x0 + step * 3} ${y}" fill="none" stroke="${c}" stroke-opacity="0.45" stroke-width="${u * 0.014}" stroke-dasharray="${u * 0.03} ${u * 0.025}"/>`;
      return out;
    }
    case 'neural': {
      const layers = [3, 5, 5, 2];
      const pts: [number, number][][] = layers.map((count, li) => Array.from({ length: count }, (_, i) => [b.x + b.w * (0.12 + (li * 0.76) / (layers.length - 1)), b.y + b.h * (0.5 + (i - (count - 1) / 2) * (0.78 / Math.max(count - 1, 1)) * (count > 1 ? 1 : 0))]));
      let out = '';
      for (let li = 0; li < pts.length - 1; li++) for (const [x1, y1] of pts[li]!) for (const [x2, y2] of pts[li + 1]!) out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${li % 2 ? c : a}" stroke-opacity="0.32" stroke-width="${u * 0.009}"/>`;
      pts.forEach((layer, li) => layer.forEach(([x, y], i) => {
        const hot = (li === 1 && i === 2) || (li === 2 && i === 1) || li === 3;
        out += `<circle cx="${x}" cy="${y}" r="${u * (hot ? 0.05 : 0.036)}" fill="${hot ? (li === 3 ? c : a) : p.bg[0]}" stroke="${li % 2 ? c : a}" stroke-width="${u * 0.016}"/>`;
      }));
      return out;
    }
    case 'cloud': {
      const w = b.w * 0.78;
      const x = cx - w / 2;
      const top = b.y + b.h * 0.16;
      let out = '';
      [0, 1, 2].forEach((i) => {
        const yy = top + i * b.h * 0.2;
        const ww = w - i * w * 0.1;
        out += `<rect x="${cx - ww / 2}" y="${yy}" width="${ww}" height="${b.h * 0.15}" rx="${b.h * 0.075}" fill="${i === 0 ? a : i === 1 ? c : a}" fill-opacity="${0.85 - i * 0.25}"/>`;
        out += `<circle cx="${cx - ww / 2 + b.h * 0.075}" cy="${yy + b.h * 0.075}" r="${b.h * 0.022}" fill="${p.bg[0]}"/>`;
        out += `<rect x="${cx - ww / 2 + b.h * 0.13}" y="${yy + b.h * 0.062}" width="${ww * 0.3}" height="${b.h * 0.026}" rx="${b.h * 0.013}" fill="${p.bg[0]}" fill-opacity="0.55"/>`;
      });
      // cloud outline above the stack
      const k = w * 0.62;
      out = `<path transform="translate(${x + w * 0.3} ${b.y - b.h * 0.12}) scale(${k})" d="M0.22 0.62 C0.06 0.62 0 0.5 0.05 0.4 C0.09 0.31 0.2 0.28 0.27 0.3 C0.3 0.17 0.42 0.1 0.55 0.13 C0.66 0.15 0.73 0.24 0.74 0.33 C0.85 0.31 0.95 0.39 0.95 0.5 C0.95 0.58 0.88 0.62 0.8 0.62 Z" fill="${c}" fill-opacity="0.1" stroke="${c}" stroke-opacity="0.55" stroke-width="${6 / k}" stroke-linejoin="round"/>` + out;
      return out;
    }
    case 'hexgrid': {
      const r = u * 0.12;
      const hw = Math.sqrt(3) * r;
      const rand = rng(7);
      let out = '';
      for (let row = -1; row < 6; row++) {
        for (let col = -1; col < 6; col++) {
          const x = b.x + col * hw + (row % 2 ? hw / 2 : 0);
          const y = b.y + row * r * 1.5;
          const pts = Array.from({ length: 6 }, (_, i) => { const ang = (Math.PI / 3) * i - Math.PI / 6; return `${x + r * 0.9 * Math.cos(ang)},${y + r * 0.9 * Math.sin(ang)}`; }).join(' ');
          const v = rand();
          const fill = v > 0.82 ? a : v > 0.68 ? c : 'none';
          out += `<polygon points="${pts}" fill="${fill}" fill-opacity="${fill === 'none' ? 0 : 0.85}" stroke="${v > 0.4 ? a : c}" stroke-opacity="${fill === 'none' ? 0.4 : 0}" stroke-width="${u * 0.01}"/>`;
          if (fill !== 'none' && v > 0.9) out += `<circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="${p.bg[0]}"/>`;
        }
      }
      return `<g clip-path="url(#motifclip)">${out}</g>`;
    }
    case 'terminal': {
      const w = b.w * 0.86;
      const h = b.h * 0.72;
      const x = cx - w / 2;
      const y = cy - h / 2;
      const rand = rng(11);
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${u * 0.05}" fill="${p.tone === 'dark' ? '#000' : '#fff'}" fill-opacity="${p.tone === 'dark' ? 0.32 : 0.6}" stroke="${a}" stroke-opacity="0.55" stroke-width="${u * 0.008}"/>`;
      out += [0, 1, 2].map((i) => `<circle cx="${x + u * 0.06 + i * u * 0.045}" cy="${y + u * 0.055}" r="${u * 0.014}" fill="${[a, c, a][i]}" fill-opacity="${0.9 - i * 0.25}"/>`).join('');
      out += `<line x1="${x}" y1="${y + u * 0.11}" x2="${x + w}" y2="${y + u * 0.11}" stroke="${a}" stroke-opacity="0.3" stroke-width="${u * 0.006}"/>`;
      const lines = 6;
      for (let i = 0; i < lines; i++) {
        const ly = y + u * 0.17 + i * ((h - u * 0.24) / lines);
        const indent = i === 0 || i === lines - 1 ? 0 : (i % 3) * u * 0.05;
        out += `<text x="${x + u * 0.05}" y="${ly + u * 0.028}" font-family="${FAMILY}" font-weight="700" font-size="${u * 0.05}" fill="${i === lines - 1 ? c : a}">${i === lines - 1 ? '$' : '›'}</text>`;
        out += `<rect x="${x + u * 0.11 + indent}" y="${ly}" width="${(w - u * 0.2 - indent) * (0.35 + rand() * 0.55)}" height="${u * 0.032}" rx="${u * 0.016}" fill="${i % 2 ? c : a}" fill-opacity="${0.45 + rand() * 0.4}"/>`;
      }
      out += `<rect x="${x + u * 0.11}" y="${y + h - u * 0.075}" width="${u * 0.025}" height="${u * 0.045}" fill="${c}"/>`;
      return out;
    }
    case 'shield': {
      const s = u * 0.0042;
      const shield = 'M0 -95 L78 -62 L78 4 C78 58 42 90 0 108 C-42 90 -78 58 -78 4 L-78 -62 Z';
      let out = [1.55, 1.28].map((k, i) => `<path d="${shield}" transform="translate(${cx} ${cy}) scale(${s * k})" fill="none" stroke="${i ? c : a}" stroke-opacity="${0.22 + i * 0.12}" stroke-width="${2.4 / k}"/>`).join('');
      out += `<path d="${shield}" transform="translate(${cx} ${cy}) scale(${s})" fill="url(#acc)" fill-opacity="0.95"/>`;
      out += `<rect x="${cx - u * 0.07}" y="${cy - u * 0.02}" width="${u * 0.14}" height="${u * 0.11}" rx="${u * 0.018}" fill="${p.bg[0]}"/>`;
      out += `<path d="M${cx - u * 0.042} ${cy - u * 0.02} v-${u * 0.035} a${u * 0.042} ${u * 0.042} 0 0 1 ${u * 0.084} 0 v${u * 0.035}" fill="none" stroke="${p.bg[0]}" stroke-width="${u * 0.02}"/>`;
      return out;
    }
    case 'graph': {
      const n = 7;
      const gw = b.w * 0.82;
      const x0 = cx - gw / 2;
      const base = b.y + b.h * 0.86;
      const bw = gw / n * 0.58;
      const hs = [0.28, 0.42, 0.35, 0.55, 0.5, 0.72, 0.9];
      let out = `<line x1="${x0}" y1="${base}" x2="${x0 + gw}" y2="${base}" stroke="${a}" stroke-opacity="0.45" stroke-width="${u * 0.008}"/>`;
      const tops: [number, number][] = [];
      hs.forEach((v, i) => {
        const x = x0 + (gw / n) * i + (gw / n - bw) / 2;
        const h = b.h * 0.7 * v;
        out += `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="${bw * 0.18}" fill="${i === n - 1 ? c : a}" fill-opacity="${i === n - 1 ? 0.95 : 0.35 + i * 0.07}"/>`;
        tops.push([x + bw / 2, base - h - b.h * 0.07]);
      });
      out += `<polyline points="${tops.map((t) => t.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${u * 0.014}" stroke-linejoin="round" stroke-linecap="round"/>`;
      out += tops.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${u * (i === n - 1 ? 0.024 : 0.013)}" fill="${c}"/>`).join('');
      return out;
    }
    case 'orbit': {
      let out = '';
      [0.46, 0.34, 0.22].forEach((k, i) => {
        out += `<ellipse cx="${cx}" cy="${cy}" rx="${u * k * 1.25}" ry="${u * k}" fill="none" stroke="${i % 2 ? c : a}" stroke-opacity="${0.5 - i * 0.08}" stroke-width="${u * 0.009}" transform="rotate(${-18 + i * 14} ${cx} ${cy})"/>`;
      });
      out += `<circle cx="${cx}" cy="${cy}" r="${u * 0.09}" fill="url(#acc)"/>`;
      const sats: [number, number, string][] = [[0.46, 30, a], [0.34, 200, c], [0.22, 120, a], [0.46, 250, c]];
      for (const [k, deg, col] of sats) {
        const t = (deg * Math.PI) / 180;
        out += `<circle cx="${cx + u * k * 1.25 * Math.cos(t)}" cy="${cy + u * k * Math.sin(t)}" r="${u * 0.026}" fill="${col}"/>`;
      }
      return out;
    }
    case 'matrix': {
      const cols = 14;
      const rows = 8;
      const gx = b.w / cols;
      const gy = b.h / rows;
      const rand = rng(23);
      let out = '';
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const v = rand();
        const r = Math.min(gx, gy) * (0.08 + v * 0.18);
        out += `<circle cx="${b.x + gx * (i + 0.5)}" cy="${b.y + gy * (j + 0.5)}" r="${r}" fill="${v > 0.7 ? c : a}" fill-opacity="${0.25 + v * 0.65}"/>`;
      }
      return out;
    }
    // ---------- Generic ----------
    case 'waves': {
      let out = '';
      const n = 6;
      for (let i = 0; i < n; i++) {
        const amp = b.h * (0.07 + i * 0.012);
        const y0 = b.y + b.h * (0.2 + i * 0.12);
        const w = b.w * 1.02;
        const x0 = b.x + b.w * 0.06;
        const seg = w / 4;
        let d = `M${x0} ${y0}`;
        for (let k = 0; k < 4; k++) d += ` q${seg / 2} ${(k % 2 ? 1 : -1) * amp * 2} ${seg} 0`;
        out += `<path d="${d}" fill="none" stroke="${i % 2 ? c : a}" stroke-opacity="${0.85 - i * 0.11}" stroke-width="${u * (0.026 - i * 0.002)}" stroke-linecap="round" transform="translate(${(i % 3) * b.w * 0.04} 0)"/>`;
      }
      return `<g clip-path="url(#motifclip)">${out}</g>`;
    }
    case 'blueprint': {
      const step = u * 0.08;
      let out = '';
      for (let x = b.x; x <= b.x + b.w + 1; x += step) out += `<line x1="${x}" y1="${b.y}" x2="${x}" y2="${b.y + b.h}" stroke="${a}" stroke-opacity="${Math.round((x - b.x) / step) % 4 ? 0.12 : 0.3}" stroke-width="1.5"/>`;
      for (let y = b.y; y <= b.y + b.h + 1; y += step) out += `<line x1="${b.x}" y1="${y}" x2="${b.x + b.w}" y2="${y}" stroke="${a}" stroke-opacity="${Math.round((y - b.y) / step) % 4 ? 0.12 : 0.3}" stroke-width="1.5"/>`;
      // construction drawing: circle, square, diagonal and dimension ticks
      out += `<circle cx="${cx - u * 0.06}" cy="${cy}" r="${u * 0.26}" fill="none" stroke="${c}" stroke-width="${u * 0.012}"/>`;
      out += `<rect x="${cx - u * 0.02}" y="${cy - u * 0.3}" width="${u * 0.34}" height="${u * 0.34}" fill="${a}" fill-opacity="0.14" stroke="${a}" stroke-width="${u * 0.01}"/>`;
      out += `<line x1="${cx - u * 0.32}" y1="${cy + u * 0.26}" x2="${cx + u * 0.32}" y2="${cy - u * 0.3}" stroke="${c}" stroke-opacity="0.7" stroke-width="${u * 0.006}" stroke-dasharray="${u * 0.02} ${u * 0.014}"/>`;
      out += `<line x1="${cx - u * 0.02}" y1="${cy + u * 0.1}" x2="${cx + u * 0.32}" y2="${cy + u * 0.1}" stroke="${a}" stroke-width="${u * 0.006}"/><line x1="${cx - u * 0.02}" y1="${cy + u * 0.08}" x2="${cx - u * 0.02}" y2="${cy + u * 0.12}" stroke="${a}" stroke-width="${u * 0.006}"/><line x1="${cx + u * 0.32}" y1="${cy + u * 0.08}" x2="${cx + u * 0.32}" y2="${cy + u * 0.12}" stroke="${a}" stroke-width="${u * 0.006}"/>`;
      out += `<circle cx="${cx - u * 0.06}" cy="${cy}" r="${u * 0.018}" fill="${c}"/>`;
      return `<g clip-path="url(#motifclip)">${out}</g>`;
    }
    case 'stripes': {
      let out = '';
      const w = u * 0.1;
      const span = b.w + b.h;
      for (let i = 0, x = b.x - b.h; x < b.x + b.w; i++, x += w * 1.6) {
        out += `<path d="M${x} ${b.y + b.h} L${x + b.h} ${b.y} L${x + b.h + w} ${b.y} L${x + w} ${b.y + b.h} Z" fill="${i % 3 === 2 ? c : a}" fill-opacity="${i % 3 === 2 ? 0.9 : 0.16 + (i % 3) * 0.14}"/>`;
      }
      void span;
      return `<g clip-path="url(#motifclip)">${out}</g>`;
    }
    case 'shapes': {
      const s = u * 0.3;
      let out = `<circle cx="${cx - s * 0.45}" cy="${cy - s * 0.35}" r="${s * 0.9}" fill="${a}" fill-opacity="0.9"/>`;
      out += `<rect x="${cx + s * 0.05}" y="${cy - s * 0.05}" width="${s * 1.1}" height="${s * 1.1}" fill="${c}" fill-opacity="0.92"/>`;
      out += `<path d="M${cx - s * 1.25} ${cy + s * 1.05} L${cx - s * 0.35} ${cy + s * 1.05} L${cx - s * 0.8} ${cy + s * 0.2} Z" fill="${p.ink}" fill-opacity="${p.tone === 'dark' ? 0.85 : 0.9}"/>`;
      // half disc resting on the square
      out += `<path d="M${cx + s * 0.05} ${cy - s * 0.05} A${s * 0.55} ${s * 0.55} 0 0 1 ${cx + s * 1.15} ${cy - s * 0.05} Z" fill="${p.ink}" fill-opacity="${p.tone === 'dark' ? 0.18 : 0.12}"/>`;
      out += `<circle cx="${cx + s * 0.6}" cy="${cy + s * 0.5}" r="${s * 0.22}" fill="${p.bg[0]}"/>`;
      return out;
    }
    case 'arcs': {
      let out = '';
      const ox = b.x + b.w;
      const oy = b.y + b.h;
      for (let i = 0; i < 7; i++) {
        const r = u * (0.18 + i * 0.13);
        out += `<path d="M${ox - r} ${oy} A${r} ${r} 0 0 1 ${ox} ${oy - r}" fill="none" stroke="${i % 2 ? c : a}" stroke-opacity="${0.95 - i * 0.1}" stroke-width="${u * 0.05}" stroke-linecap="butt"/>`;
      }
      return `<g clip-path="url(#motifclip)">${out}</g>`;
    }
    case 'dotgrid': {
      const cols = 11;
      const rows = 8;
      const gx = b.w / cols;
      const gy = b.h / rows;
      let out = '';
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const t = (i + (rows - j)) / (cols + rows);
        const hot = i - j === 3 || i - j === 4;
        out += `<circle cx="${b.x + gx * (i + 0.5)}" cy="${b.y + gy * (j + 0.5)}" r="${Math.min(gx, gy) * (hot ? 0.26 : 0.12)}" fill="${hot ? c : a}" fill-opacity="${hot ? 0.95 : 0.15 + t * 0.6}"/>`;
      }
      return out;
    }
    case 'blocks': {
      const n = 4;
      const s = Math.min(b.w, b.h) * 0.84 / n;
      const x0 = cx - (s * n) / 2;
      const y0 = cy - (s * n) / 2;
      const rand = rng(71);
      let out = '';
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = rand();
        const x = x0 + i * s;
        const y = y0 + j * s;
        const g = s * 0.08;
        if (v < 0.25) out += `<path d="M${x + g} ${y + s - g} A${s - 2 * g} ${s - 2 * g} 0 0 1 ${x + s - g} ${y + g} L${x + s - g} ${y + s - g} Z" fill="${c}" fill-opacity="0.9"/>`;
        else if (v < 0.5) out += `<rect x="${x + g}" y="${y + g}" width="${s - 2 * g}" height="${s - 2 * g}" rx="${s * 0.12}" fill="${a}" fill-opacity="${0.3 + v}"/>`;
        else if (v < 0.75) out += `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s / 2 - g}" fill="none" stroke="${a}" stroke-width="${s * 0.1}"/>`;
        else out += `<rect x="${x + g}" y="${y + g}" width="${s - 2 * g}" height="${s - 2 * g}" rx="${s * 0.12}" fill="none" stroke="${c}" stroke-opacity="0.6" stroke-width="${s * 0.05}"/>`;
      }
      return out;
    }
    case 'minimal': {
      // Type-led: a bold accent rule and corner marks; the title carries the cover.
      let out = `<rect x="${b.x + b.w - u * 0.5}" y="${b.y + b.h - u * 0.06}" width="${u * 0.5}" height="${u * 0.035}" rx="${u * 0.017}" fill="url(#acc)"/>`;
      out += `<text x="${b.x + b.w}" y="${b.y + b.h - u * 0.13}" text-anchor="end" font-family="${FAMILY}" font-weight="800" font-size="${u * 0.36}" fill="${a}" fill-opacity="0.12">DEL</text>`;
      return out;
    }
    // ---------- AI ----------
    case 'chip': {
      const s = u * 0.5;
      const x = cx - s / 2;
      const y = cy - s / 2;
      let out = '';
      const pins = 6;
      for (let i = 0; i < pins; i++) {
        const t = x + s * (0.14 + (i * 0.72) / (pins - 1));
        const l = u * 0.1;
        const pw = u * 0.012;
        out += `<line x1="${t}" y1="${y - l}" x2="${t}" y2="${y}" stroke="${a}" stroke-width="${pw}" stroke-linecap="round"/><line x1="${t}" y1="${y + s}" x2="${t}" y2="${y + s + l}" stroke="${a}" stroke-width="${pw}" stroke-linecap="round"/>`;
        out += `<line x1="${x - l}" y1="${t - x + y}" x2="${x}" y2="${t - x + y}" stroke="${c}" stroke-width="${pw}" stroke-linecap="round"/><line x1="${x + s}" y1="${t - x + y}" x2="${x + s + l}" y2="${t - x + y}" stroke="${c}" stroke-width="${pw}" stroke-linecap="round"/>`;
        out += `<circle cx="${t}" cy="${y - l}" r="${pw * 1.4}" fill="${a}"/><circle cx="${t}" cy="${y + s + l}" r="${pw * 1.4}" fill="${a}"/><circle cx="${x - l}" cy="${t - x + y}" r="${pw * 1.4}" fill="${c}"/><circle cx="${x + s + l}" cy="${t - x + y}" r="${pw * 1.4}" fill="${c}"/>`;
      }
      out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.1}" fill="${p.bg[0]}" stroke="url(#acc)" stroke-width="${u * 0.016}"/>`;
      out += `<rect x="${x + s * 0.2}" y="${y + s * 0.2}" width="${s * 0.6}" height="${s * 0.6}" rx="${s * 0.06}" fill="url(#acc)" fill-opacity="0.9"/>`;
      out += `<text x="${cx}" y="${cy + s * 0.11}" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="${s * 0.3}" fill="${p.bg[0]}">AI</text>`;
      return out;
    }
    case 'circuit': {
      const rand = rng(31);
      let out = '';
      const hub = { x: cx, y: cy };
      const n = 12;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + 0.2;
        const len = u * (0.28 + rand() * 0.2);
        const mx = hub.x + Math.cos(ang) * len * 0.55;
        const my = hub.y + Math.sin(ang) * len * 0.55;
        // orthogonal elbow: out along x, then y
        const ex = hub.x + Math.cos(ang) * len;
        const ey = hub.y + Math.sin(ang) * len;
        const col = i % 3 ? a : c;
        out += `<path d="M${hub.x} ${hub.y} L${mx} ${hub.y} L${mx} ${my} L${ex} ${ey}" fill="none" stroke="${col}" stroke-opacity="0.75" stroke-width="${u * 0.012}" stroke-linejoin="round"/>`;
        out += `<circle cx="${ex}" cy="${ey}" r="${u * 0.022}" fill="${p.bg[0]}" stroke="${col}" stroke-width="${u * 0.012}"/>`;
      }
      out += `<rect x="${hub.x - u * 0.1}" y="${hub.y - u * 0.1}" width="${u * 0.2}" height="${u * 0.2}" rx="${u * 0.03}" fill="url(#acc)"/>`;
      return out;
    }
    case 'chat': {
      const w = b.w * 0.78;
      const bh = b.h * 0.2;
      const x = cx - w / 2;
      const rows: [number, number, string, number][] = [[0, 0.72, a, 0.9], [0.24, 0.62, c, 0.85], [0.06, 0.78, a, 0.9]];
      let out = '';
      rows.forEach(([off, ww, col, op], i) => {
        const bx = x + (i % 2 ? w * (1 - ww) : 0) + (i === 2 ? 0 : w * off * 0);
        const by = b.y + b.h * 0.1 + i * (bh + b.h * 0.08);
        const bw = w * ww;
        out += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh * 0.32}" fill="${col}" fill-opacity="${i % 2 ? 0.95 : 0.18}" stroke="${col}" stroke-opacity="${i % 2 ? 0 : 0.7}" stroke-width="${u * 0.008}"/>`;
        const tail = i % 2 ? `M${bx + bw - bh * 0.5} ${by + bh} l${bh * 0.3} ${bh * 0.3} l${-bh * 0.05} ${-bh * 0.3}` : `M${bx + bh * 0.5} ${by + bh} l${-bh * 0.3} ${bh * 0.3} l${bh * 0.05} ${-bh * 0.3}`;
        out += `<path d="${tail}" fill="${col}" fill-opacity="${i % 2 ? 0.95 : 0.6}"/>`;
        const lines = i === 1 ? 1 : 2;
        for (let k = 0; k < lines; k++) out += `<rect x="${bx + bh * 0.35}" y="${by + bh * (lines === 1 ? 0.42 : 0.28 + k * 0.3)}" width="${bw * (k ? 0.5 : 0.78) - bh * 0.35}" height="${bh * 0.16}" rx="${bh * 0.08}" fill="${i % 2 ? p.bg[0] : col}" fill-opacity="${i % 2 ? 0.75 : 0.85}"/>`;
      });
      // sparkle on the assistant reply
      const sx = x + w * 0.9;
      const sy = b.y + b.h * 0.06;
      const k = u * 0.05;
      out += `<path d="M${sx} ${sy - k} Q${sx} ${sy} ${sx + k} ${sy} Q${sx} ${sy} ${sx} ${sy + k} Q${sx} ${sy} ${sx - k} ${sy} Q${sx} ${sy} ${sx} ${sy - k} Z" fill="${c}"/>`;
      return out;
    }
    case 'embedding': {
      const rand = rng(41);
      const u = Math.min(b.w * 0.62, b.h * 1.1);
      const centers: [number, number, string][] = [[0.28, 0.35, a], [0.7, 0.3, c], [0.5, 0.74, a]];
      let out = '';
      for (const [fx, fy, col] of centers) {
        const ccx = b.x + b.w * fx;
        const ccy = b.y + b.h * fy;
        out += `<circle cx="${ccx}" cy="${ccy}" r="${u * 0.2}" fill="${col}" fill-opacity="0.09"/>`;
        for (let i = 0; i < 11; i++) {
          const ang = rand() * Math.PI * 2;
          const d = u * 0.16 * Math.sqrt(rand());
          out += `<circle cx="${ccx + Math.cos(ang) * d}" cy="${ccy + Math.sin(ang) * d}" r="${u * 0.016}" fill="${col}" fill-opacity="${0.55 + rand() * 0.45}"/>`;
        }
      }
      // the query vector and its nearest neighbours
      const qx = b.x + b.w * 0.47;
      const qy = b.y + b.h * 0.42;
      const nn: [number, number][] = [[0.34, 0.33], [0.36, 0.42], [0.31, 0.45]];
      for (const [fx, fy] of nn) out += `<line x1="${qx}" y1="${qy}" x2="${b.x + b.w * fx}" y2="${b.y + b.h * fy}" stroke="${c}" stroke-width="${u * 0.008}" stroke-dasharray="${u * 0.02} ${u * 0.015}"/>`;
      out += `<circle cx="${qx}" cy="${qy}" r="${u * 0.04}" fill="${p.bg[0]}" stroke="${c}" stroke-width="${u * 0.014}"/><circle cx="${qx}" cy="${qy}" r="${u * 0.016}" fill="${c}"/>`;
      return out;
    }
    case 'attention': {
      const n = 8;
      const s = u * 0.84;
      const cell = s / n;
      const x = cx - s / 2;
      const y = cy - s / 2;
      const rand = rng(53);
      let out = '';
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const diag = i === j ? 0.55 : j < i ? 0.18 : 0;
        const v = Math.min(1, diag + rand() * 0.45);
        if (j > i) continue; // causal mask: only the lower triangle attends
        out += `<rect x="${x + j * cell + cell * 0.08}" y="${y + i * cell + cell * 0.08}" width="${cell * 0.84}" height="${cell * 0.84}" rx="${cell * 0.16}" fill="${v > 0.62 ? c : a}" fill-opacity="${0.18 + v * 0.8}"/>`;
      }
      return out;
    }
    case 'agent': {
      const tools = 6;
      const R = u * 0.36;
      let out = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${a}" stroke-opacity="0.3" stroke-width="${u * 0.008}" stroke-dasharray="${u * 0.02} ${u * 0.02}"/>`;
      for (let i = 0; i < tools; i++) {
        const ang = (i / tools) * Math.PI * 2 - Math.PI / 2;
        const tx = cx + Math.cos(ang) * R;
        const ty = cy + Math.sin(ang) * R;
        const col = i % 2 ? c : a;
        const t = u * 0.11;
        out += `<line x1="${cx}" y1="${cy}" x2="${tx}" y2="${ty}" stroke="${col}" stroke-opacity="0.55" stroke-width="${u * 0.01}"/>`;
        out += `<rect x="${tx - t / 2}" y="${ty - t / 2}" width="${t}" height="${t}" rx="${t * 0.26}" fill="${p.bg[0]}" stroke="${col}" stroke-width="${u * 0.012}"/>`;
        // a tiny glyph per tool: search, database, gear-ish, code, cloud-ish, check
        const g = t * 0.26;
        const glyphs = [
          `<circle cx="${tx - g * 0.2}" cy="${ty - g * 0.2}" r="${g * 0.7}" fill="none" stroke="${col}" stroke-width="${u * 0.009}"/><line x1="${tx + g * 0.3}" y1="${ty + g * 0.3}" x2="${tx + g}" y2="${ty + g}" stroke="${col}" stroke-width="${u * 0.009}" stroke-linecap="round"/>`,
          `<ellipse cx="${tx}" cy="${ty - g * 0.6}" rx="${g}" ry="${g * 0.38}" fill="${col}"/><rect x="${tx - g}" y="${ty - g * 0.6}" width="${g * 2}" height="${g * 1.3}" fill="${col}"/><ellipse cx="${tx}" cy="${ty + g * 0.7}" rx="${g}" ry="${g * 0.38}" fill="${col}"/>`,
          `<circle cx="${tx}" cy="${ty}" r="${g * 0.75}" fill="none" stroke="${col}" stroke-width="${u * 0.012}" stroke-dasharray="${g * 0.45} ${g * 0.25}"/><circle cx="${tx}" cy="${ty}" r="${g * 0.25}" fill="${col}"/>`,
          `<path d="M${tx - g * 0.3} ${ty - g * 0.7} l${-g * 0.6} ${g * 0.7} l${g * 0.6} ${g * 0.7} M${tx + g * 0.3} ${ty - g * 0.7} l${g * 0.6} ${g * 0.7} l${-g * 0.6} ${g * 0.7}" fill="none" stroke="${col}" stroke-width="${u * 0.01}" stroke-linecap="round" stroke-linejoin="round"/>`,
          `<rect x="${tx - g}" y="${ty - g * 0.55}" width="${g * 2}" height="${g * 1.1}" rx="${g * 0.55}" fill="${col}"/>`,
          `<path d="M${tx - g * 0.8} ${ty} l${g * 0.55} ${g * 0.55} l${g} ${-g * 1.05}" fill="none" stroke="${col}" stroke-width="${u * 0.012}" stroke-linecap="round" stroke-linejoin="round"/>`,
        ];
        out += glyphs[i];
      }
      out += `<circle cx="${cx}" cy="${cy}" r="${u * 0.13}" fill="url(#acc)"/>`;
      out += `<circle cx="${cx - u * 0.04}" cy="${cy - u * 0.01}" r="${u * 0.016}" fill="${p.bg[0]}"/><circle cx="${cx + u * 0.04}" cy="${cy - u * 0.01}" r="${u * 0.016}" fill="${p.bg[0]}"/><path d="M${cx - u * 0.045} ${cy + u * 0.045} q${u * 0.045} ${u * 0.03} ${u * 0.09} 0" fill="none" stroke="${p.bg[0]}" stroke-width="${u * 0.012}" stroke-linecap="round"/>`;
      return out;
    }
    // ---------- IT ----------
    case 'server': {
      const w = b.w * 0.62;
      const unitH = b.h * 0.16;
      const x = cx - w / 2;
      const n = 4;
      const top = cy - (n * unitH + (n - 1) * b.h * 0.035) / 2;
      let out = '';
      for (let i = 0; i < n; i++) {
        const y = top + i * (unitH + b.h * 0.035);
        out += `<rect x="${x}" y="${y}" width="${w}" height="${unitH}" rx="${unitH * 0.18}" fill="${p.tone === 'dark' ? '#000' : '#fff'}" fill-opacity="${p.tone === 'dark' ? 0.3 : 0.7}" stroke="${i % 2 ? c : a}" stroke-opacity="0.7" stroke-width="${u * 0.009}"/>`;
        for (let k = 0; k < 5; k++) out += `<rect x="${x + w * 0.08 + k * w * 0.075}" y="${y + unitH * 0.3}" width="${w * 0.04}" height="${unitH * 0.4}" rx="${w * 0.01}" fill="${a}" fill-opacity="0.4"/>`;
        out += `<circle cx="${x + w * 0.84}" cy="${y + unitH / 2}" r="${unitH * 0.11}" fill="${i === 2 ? c : a}"/><circle cx="${x + w * 0.92}" cy="${y + unitH / 2}" r="${unitH * 0.11}" fill="${c}" fill-opacity="${i % 2 ? 1 : 0.35}"/>`;
      }
      return out;
    }
    case 'database': {
      const w = u * 0.46;
      cx -= u * 0.08;
      const rx = w / 2;
      const ry = w * 0.16;
      const h = u * 0.16;
      const top = cy - (3 * h) / 2;
      let out = '';
      for (let i = 2; i >= 0; i--) {
        const y = top + i * h;
        const col = i === 1 ? c : a;
        out += `<path d="M${cx - rx} ${y} v${h * 0.82} a${rx} ${ry} 0 0 0 ${w} 0 v${-h * 0.82}" fill="${col}" fill-opacity="${0.75 - i * 0.12}"/>`;
        out += `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${col}" stroke="${p.bg[0]}" stroke-opacity="0.35" stroke-width="${u * 0.006}"/>`;
      }
      // replica to the side, linked
      const sx = cx + w * 0.78;
      const sw = w * 0.34;
      out += `<line x1="${cx + rx}" y1="${cy}" x2="${sx - sw / 2}" y2="${cy}" stroke="${c}" stroke-width="${u * 0.01}" stroke-dasharray="${u * 0.02} ${u * 0.015}"/>`;
      out += `<path d="M${sx - sw / 2} ${cy - h * 0.6} v${h * 1.2} a${sw / 2} ${sw * 0.16} 0 0 0 ${sw} 0 v${-h * 1.2}" fill="${c}" fill-opacity="0.35"/><ellipse cx="${sx}" cy="${cy - h * 0.6}" rx="${sw / 2}" ry="${sw * 0.16}" fill="${c}"/>`;
      return out;
    }
    case 'network': {
      const rand = rng(61);
      const nodes: [number, number][] = [];
      for (let i = 0; i < 9; i++) nodes.push([b.x + b.w * (0.1 + (i % 3) * 0.4 + (rand() - 0.5) * 0.12), b.y + b.h * (0.14 + Math.floor(i / 3) * 0.36 + (rand() - 0.5) * 0.1)]);
      const sw = { x: cx, y: cy };
      let out = '';
      nodes.forEach(([x, y], i) => {
        out += `<line x1="${sw.x}" y1="${sw.y}" x2="${x}" y2="${y}" stroke="${i % 2 ? c : a}" stroke-opacity="0.5" stroke-width="${u * 0.01}"/>`;
        const nb = nodes[(i + 1) % nodes.length]!;
        if (i % 3 !== 2) out += `<line x1="${x}" y1="${y}" x2="${nb[0]}" y2="${nb[1]}" stroke="${a}" stroke-opacity="0.22" stroke-width="${u * 0.007}"/>`;
      });
      nodes.forEach(([x, y], i) => { out += `<circle cx="${x}" cy="${y}" r="${u * 0.035}" fill="${p.bg[0]}" stroke="${i % 2 ? c : a}" stroke-width="${u * 0.012}"/>`; });
      out += `<rect x="${sw.x - u * 0.13}" y="${sw.y - u * 0.06}" width="${u * 0.26}" height="${u * 0.12}" rx="${u * 0.025}" fill="url(#acc)"/>`;
      for (let k = 0; k < 4; k++) out += `<circle cx="${sw.x - u * 0.075 + k * u * 0.05}" cy="${sw.y}" r="${u * 0.012}" fill="${p.bg[0]}"/>`;
      return out;
    }
    case 'gitbranch': {
      const x0 = b.x + b.w * 0.12;
      const x1 = b.x + b.w * 0.88;
      const ym = b.y + b.h * 0.62;
      const yb = b.y + b.h * 0.3;
      const bx0 = x0 + (x1 - x0) * 0.22;
      const bx1 = x0 + (x1 - x0) * 0.78;
      let out = `<line x1="${x0}" y1="${ym}" x2="${x1}" y2="${ym}" stroke="${a}" stroke-width="${u * 0.024}" stroke-linecap="round"/>`;
      const d = (bx1 - bx0) * 0.22;
      out += `<path d="M${bx0} ${ym} C${bx0 + d * 0.6} ${ym}, ${bx0 + d * 0.4} ${yb}, ${bx0 + d} ${yb} L${bx1 - d} ${yb} C${bx1 - d * 0.4} ${yb}, ${bx1 - d * 0.6} ${ym}, ${bx1} ${ym}" fill="none" stroke="${c}" stroke-width="${u * 0.024}" stroke-linecap="round"/>`;
      const commits = [0, 0.22, 0.5, 0.78, 1].map((t) => x0 + (x1 - x0) * t);
      commits.forEach((x, i) => { out += `<circle cx="${x}" cy="${ym}" r="${u * (i === 4 ? 0.05 : 0.036)}" fill="${p.bg[0]}" stroke="${a}" stroke-width="${u * 0.018}"/>`; });
      [0.42, 0.58].forEach((t) => { out += `<circle cx="${bx0 + (bx1 - bx0) * t}" cy="${yb}" r="${u * 0.036}" fill="${p.bg[0]}" stroke="${c}" stroke-width="${u * 0.018}"/>`; });
      out += `<circle cx="${x1}" cy="${ym}" r="${u * 0.02}" fill="${a}"/>`;
      return out;
    }
    case 'api': {
      const h = u * 0.62;
      const w = h * 0.3;
      const gap = u * 0.5;
      const lx = cx - gap / 2;
      const rx = cx + gap / 2;
      const brace = (x: number, dir: 1 | -1) => `<path d="M${x + dir * w} ${cy - h / 2} q${-dir * w * 0.6} 0 ${-dir * w * 0.6} ${h * 0.14} v${h * 0.2} q0 ${h * 0.12} ${-dir * w * 0.4} ${h * 0.16} q${dir * w * 0.4} ${h * 0.04} ${dir * w * 0.4} ${h * 0.16} v${h * 0.2} q0 ${h * 0.14} ${dir * w * 0.6} ${h * 0.14}" fill="none" stroke="url(#acc)" stroke-width="${u * 0.03}" stroke-linecap="round" stroke-linejoin="round"/>`;
      let out = brace(lx - w, 1) + brace(rx + w, -1);
      const rows: [string, number][] = [['GET', 0.62], ['POST', 0.48], ['PUT', 0.56]];
      rows.forEach(([verb, ww], i) => {
        const y = cy - h * 0.22 + i * h * 0.22;
        out += `<text x="${lx + w * 0.2}" y="${y + u * 0.02}" font-family="${FAMILY}" font-weight="800" font-size="${u * 0.055}" fill="${i % 2 ? c : a}">${verb}</text>`;
        out += `<rect x="${lx + w * 0.2 + u * 0.15}" y="${y - u * 0.012}" width="${(gap - u * 0.18) * ww}" height="${u * 0.024}" rx="${u * 0.012}" fill="${i % 2 ? c : a}" fill-opacity="0.6"/>`;
      });
      return out;
    }
    // ---- night-blueprint technology symbols: original drawings (never third-party logos), in prototype units of ±100 ----
    case 'cloud-chip': {
      const s = u / 266;
      const g = (inner: string) => `<g transform="translate(${cx} ${cy}) scale(${s})">${inner}</g>`;
      const pins = [-14, 0, 14].map((t) => `<path d="M${t},-22v-12M${t},30v12M-26,${t + 4}h-12M26,${t + 4}h12" stroke="${a}" stroke-width="5" stroke-linecap="round"/>`).join('');
      return g(`<path d="M-70,30 a40,40 0 0 1 10,-78 a55,55 0 0 1 104,-8 a42,42 0 0 1 26,86 z" fill="none" stroke="${a}" stroke-width="7" stroke-linejoin="round"/><rect x="-26" y="-22" width="52" height="52" rx="8" fill="${a}"/><rect x="-14" y="-10" width="28" height="28" rx="4" fill="${p.bg[0]}"/>${pins}<text x="0" y="9" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="16" fill="${a}">AI</text>`);
    }
    case 'cloud-nodes': {
      const s = u / 266;
      const pts: [number, number][] = [[-30, 0], [10, -24], [34, 12], [-4, 20]];
      const cloud = 'M-72,32 a40,40 0 0 1 8,-78 a56,56 0 0 1 106,-6 a42,42 0 0 1 28,84 z';
      const edges = pts.map(([x, y], i) => `<line x1="${x}" y1="${y}" x2="${pts[(i + 1) % 4]![0]}" y2="${pts[(i + 1) % 4]![1]}" stroke="${c}" stroke-width="4"/>`).join('');
      const nodes = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>`).join('');
      return `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="${cloud}" fill="${a}" fill-opacity="0.16"/><path d="${cloud}" fill="none" stroke="${a}" stroke-width="7" stroke-linejoin="round"/>${edges}${nodes}</g>`;
    }
    case 'neural-net': {
      const s = u / 266;
      const L: [number, number[]][] = [[-70, [-40, 0, 40]], [0, [-60, -20, 20, 60]], [70, [-30, 30]]];
      let e = '';
      for (let i = 0; i < 2; i++) for (const y1 of L[i]![1]) for (const y2 of L[i + 1]![1]) e += `<line x1="${L[i]![0]}" y1="${y1}" x2="${L[i + 1]![0]}" y2="${y2}" stroke="${i ? c : a}" stroke-width="3" stroke-opacity="0.7"/>`;
      const n = L.map(([x, ys], i) => ys.map((y) => `<circle cx="${x}" cy="${y}" r="13" fill="${i === 1 ? a : c}" stroke="${p.bg[0]}" stroke-width="4"/>`).join('')).join('');
      return `<g transform="translate(${cx} ${cy}) scale(${s})">${e}${n}</g>`;
    }
    case 'editor': {
      const s = u / 266;
      const dots = ['#ff6b6b', '#ffc145', '#4fd69a'].map((col, i) => `<circle cx="${-76 + i * 16}" cy="-57" r="5" fill="${col}"/>`).join('');
      return `<g transform="translate(${cx} ${cy}) scale(${s})"><rect x="-95" y="-70" width="190" height="140" rx="14" fill="#11163a" stroke="${a}" stroke-width="6"/><path d="M-95,-44 h190" stroke="${a}" stroke-width="4" stroke-opacity="0.6"/>${dots}<text x="-72" y="-6" font-family="${FAMILY}" font-weight="700" font-size="30" fill="${a}">{ }</text><rect x="-10" y="-22" width="72" height="8" rx="4" fill="${c}"/><rect x="-10" y="-4" width="52" height="8" rx="4" fill="${c}" fill-opacity="0.7"/><rect x="-72" y="22" width="120" height="8" rx="4" fill="#3db1ec" fill-opacity="0.6"/><path d="M-72,50 l10,6 l-10,6" fill="none" stroke="#4fd69a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="-52" y="50" width="10" height="14" fill="#4fd69a"/></g>`;
    }
    case 'flow-ai': {
      const s = u / 266;
      const boxes = ([[-80, 0], [0, -40], [0, 40], [80, 0]] as [number, number][]).map(([x, y]) => `<rect x="${x - 22}" y="${y - 22}" width="44" height="44" rx="12" fill="#11163a" stroke="${a}" stroke-width="5"/>`).join('');
      return `<g transform="translate(${cx} ${cy}) scale(${s})">${boxes}<path d="M-58,0 C-30,0 -30,-40 -22,-40 M-58,0 C-30,0 -30,40 -22,40 M22,-40 C50,-40 50,0 58,0 M22,40 C50,40 50,0 58,0" fill="none" stroke="${c}" stroke-width="5"/><circle cx="0" cy="-40" r="9" fill="${a}"/><circle cx="0" cy="40" r="9" fill="${c}"/><text x="80" y="8" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="20" fill="${a}">AI</text></g>`;
    }
    case 'container': {
      const s = u * 0.15;
      const iso = (x: number, y: number, col: string, op: number) => {
        const top = `M${x} ${y} l${s} ${-s * 0.5} l${s} ${s * 0.5} l${-s} ${s * 0.5} Z`;
        const left = `M${x} ${y} l${s} ${s * 0.5} v${s} l${-s} ${-s * 0.5} Z`;
        const right = `M${x + s} ${y + s * 0.5} l${s} ${-s * 0.5} v${s} l${-s} ${s * 0.5} Z`;
        return `<path d="${left}" fill="${col}" fill-opacity="${op * 0.75}"/><path d="${right}" fill="${col}" fill-opacity="${op * 0.5}"/><path d="${top}" fill="${col}" fill-opacity="${op}"/>`;
      };
      const grid: [number, number, number][] = [[0, 2, 0], [1, 2, 0], [2, 2, 0], [0.5, 1.25, 0], [1.5, 1.25, 0], [1, 0.5, 0], [0, 2, 1], [2, 2, 1], [1, 0.5, 1]];
      let out = '';
      const ox = cx - s * 2;
      const oy = cy - s * 0.3;
      for (const [gx, gy, layer] of grid) {
        const x = ox + gx * s * 1.05 + (gy - 1) * 0;
        const y = oy + (gy - 1) * s * 0.78 - layer * s * 1.05;
        out += iso(x, y, layer ? c : a, layer ? 0.95 : 0.8);
      }
      return out;
    }
  }
}

// ---------- layouts ----------
interface Frame {
  bg: string;
  motif: Box;
  motifOpacity?: number;
  title: Box & { anchor: 'top' | 'center' | 'bottom'; align: 'start' | 'middle'; maxLines: number; max: number; min: number };
  label: { x: number; y: number; align: 'start' | 'middle' };
  mark: { x: number; y: number; align: 'start' | 'middle' };
}

function layoutFrame(l: Layout, p: Palette): Frame {
  const veil = (from: number, to: number) => `<rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#veil)"/><linearGradient id="veil" x1="${from}" x2="${to}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.bg[0]}" stop-opacity="1"/><stop offset="0.55" stop-color="${p.bg[0]}" stop-opacity="0.85"/><stop offset="1" stop-color="${p.bg[0]}" stop-opacity="0"/></linearGradient>`;
  switch (l) {
    case 'statement':
      return { bg: '', motif: { x: 690, y: 70, w: 560, h: 580 }, title: { x: M, y: 150, w: 600, h: 405, anchor: 'bottom', align: 'start', maxLines: 4, max: 88, min: 46 }, label: { x: M, y: M, align: 'start' }, mark: { x: M, y: COVER_H - M + 4, align: 'start' }, ...{ veil: veil(0, 900) } } as Frame & { veil: string };
    case 'split':
      return { bg: `<rect x="720" y="0" width="${COVER_W - 720}" height="${COVER_H}" fill="${p.tone === 'dark' ? '#000' : '#fff'}" fill-opacity="${p.tone === 'dark' ? 0.22 : 0.45}"/><line x1="720" y1="0" x2="720" y2="${COVER_H}" stroke="${p.a}" stroke-opacity="0.35" stroke-width="2"/>`, motif: { x: 760, y: 120, w: 480, h: 480 }, title: { x: M, y: 150, w: 590, h: 440, anchor: 'center', align: 'start', maxLines: 4, max: 80, min: 42 }, label: { x: M, y: M, align: 'start' }, mark: { x: M, y: COVER_H - M + 4, align: 'start' } };
    case 'band':
      return { bg: `<rect x="0" y="0" width="${COVER_W}" height="330" fill="${p.tone === 'dark' ? '#000' : '#fff'}" fill-opacity="${p.tone === 'dark' ? 0.2 : 0.5}"/><line x1="0" y1="330" x2="${COVER_W}" y2="330" stroke="${p.a}" stroke-opacity="0.4" stroke-width="2"/>`, motif: { x: 660, y: 20, w: 560, h: 300 }, title: { x: M, y: 382, w: COVER_W - 2 * M, h: 210, anchor: 'top', align: 'start', maxLines: 2, max: 80, min: 42 }, label: { x: M, y: M, align: 'start' }, mark: { x: M, y: COVER_H - M + 4, align: 'start' } };
    case 'frame':
      return { bg: `<rect x="36" y="36" width="${COVER_W - 72}" height="${COVER_H - 72}" rx="30" fill="none" stroke="${p.a}" stroke-opacity="0.45" stroke-width="3"/>`, motif: { x: 850, y: 300, w: 360, h: 360 }, title: { x: 96, y: 170, w: 740, h: 400, anchor: 'top', align: 'start', maxLines: 3, max: 84, min: 42 }, label: { x: 96, y: 96, align: 'start' }, mark: { x: 96, y: COVER_H - 96 + 4, align: 'start' } };
    case 'spotlight':
      return { bg: '', motif: { x: 290, y: 20, w: 700, h: 680 }, motifOpacity: 0.22, title: { x: 150, y: 150, w: COVER_W - 300, h: 420, anchor: 'center', align: 'middle', maxLines: 3, max: 88, min: 44 }, label: { x: COVER_W / 2, y: M, align: 'middle' }, mark: { x: COVER_W / 2, y: COVER_H - M + 4, align: 'middle' } };
    case 'night-blueprint': // drawn by nightBlueprintSvg; this frame only keeps the switch exhaustive
    case 'light-editorial': // drawn by lightEditorialSvg
    case 'column':
      return { bg: `<rect x="0" y="0" width="400" height="${COVER_H}" fill="${p.tone === 'dark' ? '#000' : '#fff'}" fill-opacity="${p.tone === 'dark' ? 0.24 : 0.5}"/><rect x="400" y="0" width="6" height="${COVER_H}" fill="url(#acc)"/>`, motif: { x: 20, y: 150, w: 360, h: 420 }, title: { x: 470, y: 150, w: 740, h: 440, anchor: 'center', align: 'start', maxLines: 4, max: 80, min: 42 }, label: { x: 470, y: M, align: 'start' }, mark: { x: 470, y: COVER_H - M + 4, align: 'start' } };
  }
}

// ---------- the cover ----------
export interface CoverSpec { layout: Layout; palette: Palette; motif: Motif }

// ---------- the night-blueprint family (owner 2026-11-27: "Mix A + C") ----------
/** "AI for DevOps on AWS: From Fundamentals to Production" → title + subtitle; titles without ": " stay whole. */
export function splitTitle(title: string): { main: string; sub: string | null } {
  const t = title.replace(/\s+/g, ' ').trim();
  const i = t.indexOf(': ');
  if (i < 3 || i > t.length - 4) return { main: t, sub: null };
  return { main: t.slice(0, i), sub: t.slice(i + 2) };
}

/** The catalog families' title block: "Title: Subtitle" split, fitted to a column, centred between y 150 and 492. */
function catalogTitleBlock(title: string, X: number, W: number, ink: string, opts: { max?: number; oneLineMin?: number } = {}): { text: string; ruleY: number } {
  const p = { ink };
  const { main, sub } = splitTitle(title);
  const tf = fonts();
  const max = opts.max ?? 84;
  // Light editorial keeps a "Title: Subtitle" main line on one line when it still reads large (as in the prototype).
  const one = sub && opts.oneLineMin ? fitTitle(main, W, 1, max, opts.oneLineMin) : null;
  const t = one && !one.lines[0]!.endsWith('…') && one.lines.length === 1 ? one : fitTitle(main, W, sub ? 2 : 3, max, 46);
  const st = sub ? fitTitle(sub, W, 2, Math.max(30, Math.min(44, Math.round(t.size * 0.52))), 26, tf.label) : null;
  const cap = ((tf.title.tables.os2 as { sCapHeight?: number } | undefined)?.sCapHeight ?? tf.title.ascender * 0.7) / tf.title.unitsPerEm;
  const gap = st ? Math.round(st.size * 0.95) : 0;
  const blockH = cap * t.size + (t.lines.length - 1) * t.lineHeight + (st ? gap + cap * st.size + (st.lines.length - 1) * st.lineHeight : 0);
  const top = 150;
  const bottom = 492;
  const y0 = top + Math.max(0, (bottom - top - blockH) / 2) + cap * t.size;
  let y = y0;
  let text = t.lines.map((line, i) => `<text x="${X}" y="${Math.round(y0 + i * t.lineHeight)}" font-family="${FAMILY}" font-weight="800" font-size="${t.size}" letter-spacing="${TRACK * t.size}" fill="${p.ink}">${esc(line)}</text>`).join('');
  y = y0 + (t.lines.length - 1) * t.lineHeight;
  if (st) {
    const sy = y + gap + cap * st.size;
    text += st.lines.map((line, i) => `<text x="${X}" y="${Math.round(sy + i * st.lineHeight)}" font-family="${FAMILY}" font-weight="600" font-size="${st.size}" fill="${p.ink}" fill-opacity="0.86">${esc(line)}</text>`).join('');
    y = sy + (st.lines.length - 1) * st.lineHeight;
  }
  const ruleY = Math.max(520, Math.round(y + 34));
  return { text, ruleY };
}

function nightBlueprintSvg(spec: CoverSpec, input: { title: string; topic?: string | null }): string {
  const p = spec.palette;
  const X = 80;
  const tf = fonts();
  const { text, ruleY } = catalogTitleBlock(input.title, X, 680, p.ink); // the title column ends well before the symbol

  let label = '';
  if (input.topic) {
    const ls = 24;
    const lw = tf.label.getAdvanceWidth(input.topic, ls, { kerning: true }) + 40;
    label = `<rect x="${X}" y="72" width="${lw}" height="44" rx="22" fill="${p.b}" fill-opacity="0.16" stroke="${p.b}" stroke-width="2"/><text x="${X + 20}" y="101" font-family="${FAMILY}" font-weight="700" font-size="${ls}" fill="${p.b}">${esc(input.topic)}</text>`;
  }
  const markText = 'DevOps Easy Learning';
  const my = COVER_H - M + 4 - 28;
  const mark = `<g transform="translate(${X} ${my}) scale(${56 / 120})" fill="none" stroke-width="10" stroke-linecap="round"><path d="${LOOP}" stroke="url(#delmark)"/></g><text x="${X + 70}" y="${my + 22}" font-family="${FAMILY}" font-weight="700" font-size="24" fill="${p.ink}" fill-opacity="0.82">${markText}</text>`;
  const circuits = `<path d="M1280,150 H1120 l-36,36 H880 M1280,590 H1150 l-30,-30 H900 M720,690 V640 l30,-30 H860" fill="none" stroke="${p.a}" stroke-width="3" stroke-opacity="0.7"/>${[[880, 186], [900, 560], [860, 610]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="7" fill="${p.a}"/>`).join('')}`;
  const box: Box = { x: 830, y: 180, w: 360, h: 360 };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient>
  <radialGradient id="glow" cx="0.8" cy="0.45" r="0.58"><stop offset="0" stop-color="${p.a}" stop-opacity="0.42"/><stop offset="1" stop-color="${p.a}" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.055" stroke-width="1"/></pattern>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.25"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
  <mask id="gridmask"><rect width="${COVER_W}" height="${COVER_H}" fill="url(#fade)"/></mask>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>
  <linearGradient id="delmark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b7bff"/><stop offset="1" stop-color="#3db1ec"/></linearGradient>
</defs>
<rect width="${COVER_W}" height="${COVER_H}" fill="url(#bg)"/>
<rect width="${COVER_W}" height="${COVER_H}" fill="url(#grid)" mask="url(#gridmask)"/>
<rect width="${COVER_W}" height="${COVER_H}" fill="url(#glow)"/>
${circuits}
${motifSvg(spec.motif, box, p)}
${label}
${text}
<rect x="${X}" y="${ruleY}" width="90" height="6" rx="3" fill="${p.a}"/>
${mark}
</svg>`;
}

// ---------- the light-editorial family (owner 2026-11-27: Family B, the approved alternative) ----------
const PAPER = '#f7f8fc';
const INK = '#0f1330';
function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
}
/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/** The accent mixed toward the ink until small text on the paper reaches 4.5:1 (AWS orange becomes a deep amber). */
export function readableAccent(accent: string, ground = PAPER): string {
  const mix = (t: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(accent.slice(i, i + 2), 16) * (1 - t) + parseInt(INK.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
  for (let k = 0; k <= 50; k++) if (contrast(mix(k / 50), ground) >= 4.5) return mix(k / 50);
  return INK;
}

function lightEditorialSvg(spec: CoverSpec, input: { title: string; topic?: string | null }): string {
  const p = spec.palette;
  const X = 80;
  const { text, ruleY } = catalogTitleBlock(input.title, X, 690, INK, { max: 74, oneLineMin: 54 });
  const label = input.topic ? `<text x="${X}" y="120" font-family="${FAMILY}" font-weight="700" font-size="24" fill="${readableAccent(p.a)}">${esc(input.topic)}</text>` : '';
  const my = COVER_H - M + 4 - 28;
  const mark = `<g transform="translate(${X} ${my}) scale(${56 / 120})" fill="none" stroke-width="10" stroke-linecap="round"><path d="${LOOP}" stroke="url(#delmark)"/></g><text x="${X + 70}" y="${my + 22}" font-family="${FAMILY}" font-weight="700" font-size="24" fill="${INK}" fill-opacity="0.86">DevOps Easy Learning</text>`;
  // The symbol sits in a dark ink circle, so motifs keep the dark-ground colours they were drawn for.
  const symbolPalette: Palette = { ...p, bg: [INK, INK] };
  const box: Box = { x: 870, y: 180, w: 360, h: 360 };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">
<defs>
  <linearGradient id="delmark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6f5fe0"/><stop offset="1" stop-color="#1e9bd7"/></linearGradient>
</defs>
<rect width="${COVER_W}" height="${COVER_H}" fill="${PAPER}"/>
<rect x="820" y="0" width="${COVER_W - 820}" height="${COVER_H}" fill="${p.a}"/>
<rect x="820" y="0" width="${COVER_W - 820}" height="${COVER_H}" fill="${INK}" fill-opacity="0.18"/>
<circle cx="1050" cy="360" r="190" fill="${INK}" fill-opacity="0.92"/>
${motifSvg(spec.motif, box, symbolPalette)}
${label}
${text}
<rect x="${X}" y="${ruleY}" width="90" height="6" rx="3" fill="${p.a}"/>
${mark}
</svg>`;
}


export function coverSvg(spec: CoverSpec, input: { title: string; topic?: string | null }): string {
  if (spec.layout === 'night-blueprint') return nightBlueprintSvg(spec, input);
  if (spec.layout === 'light-editorial') return lightEditorialSvg(spec, input);
  const p = spec.palette;
  const f = layoutFrame(spec.layout, p) as Frame & { veil?: string };
  const t = fitTitle(input.title, f.title.w, f.title.maxLines, f.title.max, f.title.min);
  const font = fonts().title;
  const cap = ((font.tables.os2 as { sCapHeight?: number } | undefined)?.sCapHeight ?? font.ascender * 0.7) / font.unitsPerEm;
  const blockH = cap * t.size + (t.lines.length - 1) * t.lineHeight;
  const firstBaseline = f.title.anchor === 'top' ? f.title.y + cap * t.size : f.title.anchor === 'bottom' ? f.title.y + f.title.h - (t.lines.length - 1) * t.lineHeight : f.title.y + (f.title.h - blockH) / 2 + cap * t.size;
  const tx = f.title.align === 'middle' ? f.title.x + f.title.w / 2 : f.title.x;
  const anchor = f.title.align === 'middle' ? 'middle' : 'start';
  const titleSvg = t.lines.map((line, i) => `<text x="${tx}" y="${Math.round(firstBaseline + i * t.lineHeight)}" text-anchor="${anchor}" font-family="${FAMILY}" font-weight="800" font-size="${t.size}" letter-spacing="${TRACK * t.size}" fill="${p.ink}">${esc(line)}</text>`).join('');

  // topic label: a pill sized to its text
  let labelSvg = '';
  if (input.topic) {
    const lf = fonts().label;
    const ls = 26;
    const lw = lf.getAdvanceWidth(input.topic, ls, { kerning: true }) + 40;
    const lx = f.label.align === 'middle' ? f.label.x - lw / 2 : f.label.x;
    labelSvg = `<rect x="${lx}" y="${f.label.y}" width="${lw}" height="46" rx="23" fill="${p.a}" fill-opacity="${p.tone === 'dark' ? 0.18 : 0.12}" stroke="${p.a}" stroke-opacity="0.35" stroke-width="1.5"/><text x="${lx + 20}" y="${f.label.y + 31}" font-family="${FAMILY}" font-weight="700" font-size="${ls}" fill="${p.tone === 'dark' ? p.a : p.a}">${esc(input.topic)}</text>`;
  }

  // DEL mark: the loop and the name
  const markText = 'DevOps Easy Learning';
  const mw = 56 + 14 + fonts().label.getAdvanceWidth(markText, 24);
  const mx = f.mark.align === 'middle' ? f.mark.x - mw / 2 : f.mark.x;
  const my = f.mark.y - 28;
  const markSvg = `<path d="${LOOP}" fill="none" stroke="url(#acc)" stroke-width="10" stroke-linecap="round" transform="translate(${mx} ${my}) scale(${56 / 120})"/><text x="${mx + 70}" y="${my + 22}" font-family="${FAMILY}" font-weight="700" font-size="24" fill="${p.ink}" fill-opacity="0.82">${markText}</text>`;

  const m = f.motif;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>
  <clipPath id="motifclip"><rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="24"/></clipPath>
</defs>
<rect width="${COVER_W}" height="${COVER_H}" fill="url(#bg)"/>
${f.bg}
<g opacity="${f.motifOpacity ?? 1}">${motifSvg(spec.motif, m, p)}</g>
${f.veil ?? ''}
${labelSvg}
${titleSvg}
${markSvg}
</svg>`;
}

/** PNG of a cover at the given width (default the full 1280×720). */
export function coverPng(spec: CoverSpec, input: { title: string; topic?: string | null }, width = COVER_W): Buffer {
  const svg = coverSvg(spec, input);
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: fonts().files, loadSystemFonts: false, defaultFontFamily: FAMILY },
  });
  return r.render().asPng();
}
