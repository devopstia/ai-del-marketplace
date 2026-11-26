/**
 * Data saver (owner 2026-11-26): learners on mobile data choose Auto, Low (360p) or Audio only. The choice is remembered
 * in this browser only. Sizes come from the API (bytes per setting, measured when the video was packaged).
 * docs/VIDEO_DELIVERY.md.
 */
export type DataMode = "auto" | "low" | "audio";
export interface LessonSizes { auto: number; low: number | null; audio: number | null }

const KEY = "del-data-saver";
export const DATA_MODES: { value: DataMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Best picture your connection allows" },
  { value: "low", label: "Low (360p)", hint: "Smaller picture, much less data" },
  { value: "audio", label: "Audio only", hint: "Sound only, picture off" },
];

export function readDataMode(): DataMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "low" || v === "audio" ? v : "auto";
  } catch { return "auto"; }
}
export function saveDataMode(m: DataMode) {
  try { localStorage.setItem(KEY, m); } catch { /* storage blocked */ }
}

/** Bytes at a setting; a setting the video doesn't have falls back to what would actually play. */
export function sizeFor(s: LessonSizes | null | undefined, m: DataMode): number | null {
  if (!s) return null;
  if (m === "audio" && s.audio) return s.audio;
  if (m !== "auto" && s.low) return s.low;
  return s.auto;
}

/** "about 12 MB" / "about 1.2 GB"; under 1 MB rounds up to 1 MB. */
export function aboutSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / 1_000_000;
  if (mb >= 1000) return `about ${(mb / 1000).toFixed(1)} GB`;
  return `about ${Math.max(1, mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb))} MB`;
}

export function toSizes(x: unknown): LessonSizes | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
  const auto = n(o.auto);
  return auto ? { auto, low: n(o.low), audio: n(o.audio) } : null;
}
