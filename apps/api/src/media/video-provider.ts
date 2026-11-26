import type { VideoAsset } from '../generated/prisma/client';

export interface UploadTarget {
  assetId: string;
  provider: 'local' | 'mux';
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface Playback {
  url: string;
  expiresAt: string;
  /** mp4 = progressive file (local provider), hls = .m3u8 stream (mux) */
  format: 'mp4' | 'hls';
  /** WebVTT; the player shows captions OFF by default, the learner can turn them on */
  captionsUrl?: string;
  /** Content protection: encrypted HLS through a playback session (no file link to the original). */
  protected?: boolean;
  /**
   * Data saver (protected HLS with several qualities): playlists for Low (360p) and Audio only, and about how many bytes
   * the lesson takes at each setting. Absent when the video has one quality.
   */
  dataSaver?: { low?: string; audio?: string; sizes?: { auto: number; low: number | null; audio: number | null } };
}

/** The only surface the rest of the app uses for video. Swap providers without touching callers. */
export interface VideoProvider {
  readonly name: 'local' | 'mux';
  createUpload(ownerId: string, opts: { filename: string; contentType: string; courseId?: string | null }): Promise<UploadTarget>;
  /** Called when the browser says the upload finished. */
  onUploaded(asset: VideoAsset): Promise<void>;
  playbackUrl(asset: VideoAsset, userId: string | null): Promise<Playback>;
}

export const PLAYBACK_TTL_SEC = 300;
