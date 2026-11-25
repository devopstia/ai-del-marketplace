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
function fonts() {
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
function width(font: opentype.Font, text: string, size: number) {
  return font.getAdvanceWidth(text, size, { kerning: true }) + TRACK * size * Math.max(0, text.length - 1);
}

function wrap(font: opentype.Font, words: string[], size: number, maxW: number): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (width(font, w, size) > maxW) return null; // a single word too wide: needs a smaller size
    const next = line ? `${line} ${w}` : w;
    if (width(font, next, size) <= maxW) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

export interface FittedTitle { size: number; lineHeight: number; lines: string[] }

/** Largest size (step 2px) at which the title fits `maxLines` lines of `maxW`; below `min`, the last line is shortened with "…". */
export function fitTitle(title: string, maxW: number, maxLines: number, max: number, min: number): FittedTitle {
  const font = fonts().title;
  const words = title.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) words.push('Untitled course');
  for (let size = max; size >= min; size -= 2) {
    const lines = wrap(font, words, size, maxW);
    if (lines && lines.length <= maxLines) return { size, lineHeight: Math.round(size * 1.06), lines };
  }
  // Very long titles: smallest size, words broken only if a single word is wider than the box, last line ellipsed.
  let size = min;
  while (size > 28 && words.some((w) => width(font, w, size) > maxW)) size -= 2;
  const safe = words.map((w) => {
    let x = w;
    while (width(font, x, size) > maxW && x.length > 1) x = x.slice(0, -1);
    return x === w ? w : `${x.slice(0, -1)}…`;
  });
  const lines = wrap(font, safe, size, maxW) ?? safe;
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last && width(font, `${last}…`, size) > maxW) last = last.replace(/\s*\S+$/, '');
    kept[maxLines - 1] = `${last || kept[maxLines - 1]!.slice(0, 8)}…`;
    return { size, lineHeight: Math.round(size * 1.06), lines: kept };
  }
  return { size, lineHeight: Math.round(size * 1.06), lines };
}

// ---------- drawing helpers ----------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOOP = 'M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30';
interface Box { x: number; y: number; w: number; h: number }

/** Seeded pseudo-random numbers so a motif looks the same every time it is drawn. */
function rng(seed: number) {
  let s = (seed % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function motifSvg(m: Motif, b: Box, p: Palette): string {
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
    case 'column':
      return { bg: `<rect x="0" y="0" width="400" height="${COVER_H}" fill="${p.tone === 'dark' ? '#000' : '#fff'}" fill-opacity="${p.tone === 'dark' ? 0.24 : 0.5}"/><rect x="400" y="0" width="6" height="${COVER_H}" fill="url(#acc)"/>`, motif: { x: 20, y: 150, w: 360, h: 420 }, title: { x: 470, y: 150, w: 740, h: 440, anchor: 'center', align: 'start', maxLines: 4, max: 80, min: 42 }, label: { x: 470, y: M, align: 'start' }, mark: { x: 470, y: COVER_H - M + 4, align: 'start' } };
  }
}

// ---------- the cover ----------
export interface CoverSpec { layout: Layout; palette: Palette; motif: Motif }

export function coverSvg(spec: CoverSpec, input: { title: string; topic?: string | null }): string {
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
