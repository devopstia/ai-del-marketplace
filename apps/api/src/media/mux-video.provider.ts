import { Injectable } from '@nestjs/common';
import Mux from '@mux/mux-node';
import type { VideoAsset } from '../generated/prisma/client';
import { badRequest, unavailable } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';
import { Playback, PLAYBACK_TTL_SEC, UploadTarget, VideoProvider } from './video-provider';

/** Mux: direct uploads from the browser, signed playback (JWT), `video.asset.ready` webhook finalises the asset. */
@Injectable()
export class MuxVideoProvider implements VideoProvider {
  readonly name = 'mux' as const;
  private client?: Mux;
  constructor(private readonly prisma: PrismaService) {}

  get configured() {
    const e = env();
    return !!(e.MUX_TOKEN_ID && e.MUX_TOKEN_SECRET);
  }

  mux(): Mux {
    if (!this.configured) throw unavailable('Mux is not configured (MUX_TOKEN_ID / MUX_TOKEN_SECRET)', 'mux_not_configured');
    const e = env();
    this.client ??= new Mux({
      tokenId: e.MUX_TOKEN_ID,
      tokenSecret: e.MUX_TOKEN_SECRET,
      webhookSecret: e.MUX_WEBHOOK_SECRET || null,
      jwtSigningKey: e.MUX_SIGNING_KEY_ID || null,
      jwtPrivateKey: e.MUX_SIGNING_PRIVATE_KEY || null,
    });
    return this.client;
  }

  async createUpload(ownerId: string): Promise<UploadTarget> {
    const upload = await this.mux().video.uploads.create({
      cors_origin: env().WEB_URL,
      new_asset_settings: { playback_policies: ['signed'], video_quality: 'basic' },
    });
    const asset = await this.prisma.videoAsset.create({
      data: { ownerId, provider: 'mux', status: 'uploading', muxUploadId: upload.id },
    });
    return {
      assetId: asset.id,
      provider: 'mux',
      uploadUrl: upload.url ?? '',
      method: 'PUT',
      headers: {},
      expiresAt: new Date(Date.now() + (upload.timeout ?? 3600) * 1000).toISOString(),
    };
  }

  async onUploaded(asset: VideoAsset) {
    if (!asset.muxUploadId) throw badRequest('Not a Mux upload');
    const upload = await this.mux().video.uploads.retrieve(asset.muxUploadId);
    await this.prisma.videoAsset.update({
      where: { id: asset.id },
      data: { status: 'processing', muxAssetId: upload.asset_id ?? undefined },
    });
  }

  /** Webhook `video.asset.ready`. */
  async markReady(muxAssetId: string, uploadId: string | undefined, playbackId: string | undefined, durationSec: number) {
    const asset = await this.prisma.videoAsset.findFirst({
      where: { OR: [{ muxAssetId }, ...(uploadId ? [{ muxUploadId: uploadId }] : [])] },
    });
    if (!asset) return;
    const d = Math.round(durationSec);
    await this.prisma.videoAsset.update({
      where: { id: asset.id },
      data: { status: 'ready', muxAssetId, muxPlaybackId: playbackId, durationSec: d },
    });
    await this.prisma.lecture.updateMany({ where: { videoAssetId: asset.id }, data: { durationSec: d } });
  }

  async markFailed(muxAssetId: string, message: string) {
    await this.prisma.videoAsset.updateMany({ where: { muxAssetId }, data: { status: 'failed', error: message.slice(0, 500) } });
  }

  async playbackUrl(asset: VideoAsset): Promise<Playback> {
    if (!asset.muxPlaybackId) throw badRequest('Video is not ready', 'video_unavailable');
    const e = env();
    if (!e.MUX_SIGNING_KEY_ID || !e.MUX_SIGNING_PRIVATE_KEY) throw unavailable('Mux signing key is not configured', 'mux_not_configured');
    const token = await this.mux().jwt.signPlaybackId(asset.muxPlaybackId, { type: 'video', expiration: `${PLAYBACK_TTL_SEC}s` });
    return {
      url: `https://stream.mux.com/${asset.muxPlaybackId}.m3u8?token=${token}`,
      expiresAt: new Date(Date.now() + PLAYBACK_TTL_SEC * 1000).toISOString(),
      format: 'hls',
    };
  }
}
