/**
 * Search and retrieval helpers (pure, unit tested). The database does the matching with Postgres full-text search;
 * these functions build safe query strings and turn ranked hits into the passages the assistant is allowed to use.
 */

/** Lower-case word tokens (letters, digits; inner dots/dashes split), at most `max`, duplicates removed. */
export function tokenize(q: string, max = 8): string[] {
  const words = q
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 1 && w.length <= 40);
  return [...new Set(words)].slice(0, max);
}

/**
 * to_tsquery text for "search inside videos": every word must appear, the last one as a prefix (results while typing,
 * "kube" finds "kubernetes"). Tokens are [a-z0-9]+ only, so the string can't carry tsquery operators. Null = nothing to search.
 */
export function searchTsQuery(q: string): string | null {
  const t = tokenize(q);
  if (!t.length) return null;
  return t.map((w, i) => (i === t.length - 1 && w.length >= 2 ? `${w}:*` : w)).join(' & ');
}

/** to_tsquery text for the assistant's retrieval: any of the words (ranking prefers passages with more of them). */
export function retrievalTsQuery(q: string): string | null {
  const t = tokenize(q, 16).filter((w) => w.length >= 2 || /\d/.test(w));
  return t.length ? t.join(' | ') : null;
}

export interface RankedHit {
  videoAssetId: string;
  seq: number;
  rank: number;
}
export interface SegmentRow {
  videoAssetId: string;
  seq: number;
  startSec: number;
  endSec: number;
  text: string;
}
export interface Passage {
  videoAssetId: string;
  fromSeq: number;
  toSeq: number;
  startSec: number;
  endSec: number;
  text: string;
  rank: number;
}

/** Which segments to load around the best hits: each hit plus `around` neighbours on each side. */
export function windowsFor(hits: RankedHit[], opts: { top?: number; around?: number } = {}): { videoAssetId: string; seq: number }[] {
  const top = opts.top ?? 8;
  const around = opts.around ?? 1;
  const out = new Map<string, { videoAssetId: string; seq: number }>();
  for (const h of [...hits].sort((a, b) => b.rank - a.rank).slice(0, top)) {
    for (let s = Math.max(0, h.seq - around); s <= h.seq + around; s++) out.set(`${h.videoAssetId}:${s}`, { videoAssetId: h.videoAssetId, seq: s });
  }
  return [...out.values()];
}

/**
 * Joins loaded segments into contiguous passages (a hit and its neighbours read as one), ranks each passage by its best
 * hit, keeps the best ones within `maxChars` and returns them in course order of (video, time) for a readable prompt.
 */
export function buildPassages(hits: RankedHit[], rows: SegmentRow[], opts: { maxChars?: number; maxPassages?: number } = {}): Passage[] {
  const maxChars = opts.maxChars ?? 7000;
  const maxPassages = opts.maxPassages ?? 8;
  const rankOf = new Map(hits.map((h) => [`${h.videoAssetId}:${h.seq}`, h.rank]));
  const sorted = [...rows].sort((a, b) => (a.videoAssetId === b.videoAssetId ? a.seq - b.seq : a.videoAssetId < b.videoAssetId ? -1 : 1));
  const passages: Passage[] = [];
  for (const r of sorted) {
    const last = passages[passages.length - 1];
    const rank = rankOf.get(`${r.videoAssetId}:${r.seq}`) ?? 0;
    if (last && last.videoAssetId === r.videoAssetId && r.seq === last.toSeq + 1) {
      last.toSeq = r.seq;
      last.endSec = r.endSec;
      last.text = `${last.text} ${r.text}`;
      last.rank = Math.max(last.rank, rank);
    } else {
      passages.push({ videoAssetId: r.videoAssetId, fromSeq: r.seq, toSeq: r.seq, startSec: r.startSec, endSec: r.endSec, text: r.text, rank });
    }
  }
  const chosen: Passage[] = [];
  let used = 0;
  for (const p of passages.filter((x) => x.rank > 0).sort((a, b) => b.rank - a.rank)) {
    if (chosen.length >= maxPassages) break;
    const text = p.text.length > 1500 ? `${p.text.slice(0, 1500)}…` : p.text;
    if (used + text.length > maxChars) continue;
    chosen.push({ ...p, text });
    used += text.length;
  }
  return chosen;
}

/** Lessons whose title or summary shares a word with the question (used with the outline; tells "no material" apart). */
export function matchingLessons<T extends { title: string; summary?: string | null }>(lessons: T[], question: string): T[] {
  const words = new Set(tokenize(question, 16).filter((w) => w.length >= 3 && !STOP.has(w)));
  if (!words.size) return [];
  return lessons.filter((l) => tokenize(`${l.title} ${l.summary ?? ''}`, 64).some((w) => words.has(w) || (w.length > 4 && [...words].some((q) => q.length > 4 && (w.startsWith(q) || q.startsWith(w))))));
}

const STOP = new Set(['the', 'and', 'for', 'are', 'how', 'what', 'why', 'when', 'where', 'which', 'who', 'does', 'did', 'can', 'could', 'should', 'would', 'this', 'that', 'with', 'from', 'about', 'into', 'your', 'you', 'use', 'using', 'lesson', 'course', 'video', 'explain', 'tell']);

/**
 * Marks the words of a passage that match the query (same word, or sharing its start: "deploy" marks "deployment",
 * the way the English stemmer matched it). Returned as parts the browser renders as text, never as HTML.
 */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = tokenize(query, 16).filter((w) => w.length >= 2);
  const hit = (word: string) => {
    const w = tokenize(word, 1)[0];
    if (!w) return false;
    return q.some((t) => w === t || (t.length >= 3 && w.startsWith(t)) || (w.length >= 4 && t.startsWith(w)));
  };
  const out: { text: string; match: boolean }[] = [];
  for (const piece of text.split(/(\s+)/)) {
    if (!piece) continue;
    const match = /\S/.test(piece) && hit(piece);
    const last = out[out.length - 1];
    if (last && !last.match && !match) last.text += piece;
    else out.push({ text: piece, match });
  }
  return out;
}
