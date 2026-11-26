/**
 * Data saver (owner 2026-11-26, idea 1): learners on mobile data pick Auto, Low (360p) or Audio only, and see about how
 * many MB a lesson costs at their setting. Pure helpers, shared by the packager, the playback session and the curriculum.
 * docs/VIDEO_DELIVERY.md.
 */

/** What the size and choice helpers need from a packaged quality (the full Variant also carries its playlist). */
export interface VariantInfo { name: string; height: number; bandwidth: number; bytes?: number }

/** Bytes of one lesson at each data-saver setting, saved on the video asset when it is packaged (hlsSizes). */
export interface HlsSizes {
  /** The packaging settings these sizes were made with: a change of settings marks the video for re-packaging. */
  config: string;
  /** Auto: the largest picture the player may choose (an upper bound; slow connections use less). */
  auto: number;
  /** Low: the 360p copy (or the smallest picture when there is no 360p). */
  low: number | null;
  /** Audio only (null when the video has no sound). */
  audio: number | null;
}

export const AUDIO = 'audio';
export const LOW_HEIGHT = 360;

/** The packaging settings in one string, e.g. "720,480,360+audio". */
export function packagingConfig(renditions: string, audioOnly: boolean): string {
  const r = renditions.split(',').map((x) => x.trim()).filter(Boolean).join(',');
  return `${r}${audioOnly ? '+audio' : ''}`;
}

const isVideo = (v: VariantInfo) => v.name !== AUDIO && v.height > 0;

/** The quality Low plays: 360p when there is one, else the smallest picture; null with a single picture quality. */
export function lowVariant<T extends VariantInfo>(variants: T[]): T | null {
  const video = variants.filter(isVideo);
  if (video.length < 2) return null;
  return video.find((v) => v.height === LOW_HEIGHT) ?? [...video].sort((a, b) => a.height - b.height)[0]!;
}

export function audioVariant<T extends VariantInfo>(variants: T[]): T | null {
  return variants.find((v) => v.name === AUDIO) ?? null;
}

/** Bytes of one quality: what was uploaded when known, else from its bit rate (the playlist's peak is average + 25 %). */
export function variantBytes(v: VariantInfo, durationSec: number): number {
  if (v.bytes && v.bytes > 0) return v.bytes;
  return Math.round(((v.bandwidth / 1.25) * Math.max(0, durationSec)) / 8);
}

export function lessonSizes(variants: VariantInfo[], durationSec: number, config: string): HlsSizes | null {
  const video = variants.filter(isVideo);
  if (!video.length) return null;
  const top = [...video].sort((a, b) => b.bandwidth - a.bandwidth)[0]!;
  const low = lowVariant(variants);
  const audio = audioVariant(variants);
  return {
    config,
    auto: variantBytes(top, durationSec),
    low: low ? variantBytes(low, durationSec) : null,
    audio: audio ? variantBytes(audio, durationSec) : null,
  };
}

/** True when a packaged video was made with other settings than now (missing 360p or audio only, for example). */
export function needsRepackaging(sizes: unknown, config: string): boolean {
  return !sizes || typeof sizes !== 'object' || (sizes as { config?: unknown }).config !== config;
}

/** The stored sizes as sent to learners (no settings string); undefined when unknown. */
export function sizesOf(raw: unknown): Omit<HlsSizes, 'config'> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null);
  const auto = n(o.auto);
  return auto ? { auto, low: n(o.low), audio: n(o.audio) } : undefined;
}
