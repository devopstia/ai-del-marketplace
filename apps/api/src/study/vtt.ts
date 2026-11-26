/**
 * WebVTT → searchable passages (docs/AI_LEARNING.md). Caption cues are short (1–5 s); a phrase often spans two of
 * them, so consecutive cues are merged into passages of about 15 seconds. A search hit then jumps to the start of the
 * passage, a few seconds before the words are spoken, which is what a learner wants anyway.
 */
export interface Cue {
  start: number;
  end: number;
  text: string;
}
export interface Segment extends Cue {
  seq: number;
}

const TIME = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/;

export function parseTimestamp(s: string): number | null {
  const m = TIME.exec(s.trim());
  if (!m) return null;
  const [, h, mm, ss, ms] = m;
  return Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, '0')) / 1000;
}

/** Plain text of a cue payload: no tags (<v Speaker>, <b>, <00:01.000>), entities decoded, whitespace collapsed. */
export function cueText(payload: string): string {
  return payload
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parses WebVTT (and tolerates SRT-style comma milliseconds). Skips NOTE/STYLE/REGION blocks and empty cues. */
export function parseVtt(source: string): Cue[] {
  const blocks = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[0] ?? '')) continue;
    const [a, rest] = lines[at].split('-->');
    const start = parseTimestamp(a);
    const end = parseTimestamp((rest ?? '').trim().split(/\s+/)[0] ?? '');
    if (start == null || end == null || end < start) continue;
    const text = cueText(lines.slice(at + 1).join(' '));
    if (text) cues.push({ start, end, text });
  }
  cues.sort((x, y) => x.start - y.start);
  // Roll-up captions repeat the previous line: drop a cue that is exactly the one before it.
  return cues.filter((c, i) => i === 0 || c.text !== cues[i - 1].text);
}

/** Merges consecutive cues until a passage reaches maxSec or maxChars (or a pause longer than gapSec). */
export function mergeCues(cues: Cue[], opts: { maxSec?: number; maxChars?: number; gapSec?: number } = {}): Segment[] {
  const maxSec = opts.maxSec ?? 15;
  const maxChars = opts.maxChars ?? 300;
  const gapSec = opts.gapSec ?? 4;
  const out: Segment[] = [];
  let cur: Segment | null = null;
  for (const c of cues) {
    if (cur && c.start - cur.end <= gapSec && c.end - cur.start <= maxSec && cur.text.length + 1 + c.text.length <= maxChars) {
      cur.end = Math.max(cur.end, c.end);
      cur.text = `${cur.text} ${c.text}`;
      continue;
    }
    if (cur) out.push(cur);
    cur = { seq: out.length, start: c.start, end: c.end, text: c.text.slice(0, maxChars * 2) };
  }
  if (cur) out.push(cur);
  return out.map((s) => ({ ...s, start: round(s.start), end: round(s.end) }));
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Transcript text with a [mm:ss] mark per passage, for the study-notes prompt. */
export function transcriptWithTimes(segments: Pick<Segment, 'start' | 'text'>[], maxChars = 60_000): { text: string; truncated: boolean } {
  let text = '';
  for (const s of segments) {
    const line = `[${mmss(s.start)}] ${s.text}\n`;
    if (text.length + line.length > maxChars) return { text, truncated: true };
    text += line;
  }
  return { text, truncated: false };
}

export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
