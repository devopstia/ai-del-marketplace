import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { VideoAsset } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { env } from '../config/env';
import { LocalVideoProvider } from './local-video.provider';
import { MuxVideoProvider } from './mux-video.provider';
import { Playback, VideoProvider } from './video-provider';

const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_RESOURCE_BYTES = 200 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly local: LocalVideoProvider,
    private readonly muxProvider: MuxVideoProvider,
  ) {}

  /** Provider for new uploads (VIDEO_PROVIDER). */
  get uploadProvider(): VideoProvider {
    return env().VIDEO_PROVIDER === 'mux' ? this.muxProvider : this.local;
  }

  /** Provider that stores this asset (assets keep working when VIDEO_PROVIDER changes). */
  providerFor(asset: Pick<VideoAsset, 'provider'>): VideoProvider {
    return asset.provider === 'mux' ? this.muxProvider : this.local;
  }

  async createVideoUpload(a: Actor, input: { filename: string; contentType: string }) {
    const target = await this.uploadProvider.createUpload(a.user.id, input);
    await this.audit.log({ actorId: a.user.id, action: 'media.video_upload_created', targetType: 'video_asset', targetId: target.assetId, ip: a.ip });
    return target;
  }

  async ownedAsset(ownerId: string, assetId: string) {
    const asset = await this.prisma.videoAsset.findFirst({ where: { id: assetId, ownerId } });
    if (!asset) throw notFound('Video');
    return asset;
  }

  async completeVideoUpload(a: Actor, assetId: string) {
    const asset = await this.ownedAsset(a.user.id, assetId);
    if (asset.status === 'ready') return this.assetView(asset);
    await this.providerFor(asset).onUploaded(asset);
    return this.assetView(await this.prisma.videoAsset.findUniqueOrThrow({ where: { id: asset.id } }));
  }

  async captionsUpload(a: Actor, assetId: string) {
    const asset = await this.ownedAsset(a.user.id, assetId);
    if (asset.provider !== 'local') throw badRequest('Mux generates captions automatically', 'unsupported');
    const key = `videos/${asset.id}/captions.vtt`;
    await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { captionsKey: key } });
    return { uploadUrl: await this.storage.presignPut(key, 'text/vtt'), method: 'PUT', headers: { 'Content-Type': 'text/vtt' } };
  }

  async getAsset(ownerId: string, assetId: string) {
    return this.assetView(await this.ownedAsset(ownerId, assetId));
  }

  listAssets(ownerId: string) {
    return this.prisma.videoAsset
      .findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' }, take: 200 })
      .then((rows) => rows.map((r) => this.assetView(r)));
  }

  assetView(a: VideoAsset) {
    return { id: a.id, provider: a.provider, status: a.status, durationSec: a.durationSec, hasCaptions: !!a.captionsKey, error: a.error, createdAt: a.createdAt };
  }

  async playback(asset: VideoAsset, userId: string | null): Promise<Playback> {
    if (asset.status !== 'ready') throw badRequest('This video is still processing', 'video_not_ready');
    return this.providerFor(asset).playbackUrl(asset, userId);
  }

  /** Resource (ZIP, script, PDF) upload: presigned PUT under the owner's prefix; finalised by completeResourceUpload. */
  async resourceUpload(ownerId: string, input: { filename: string; contentType: string; sizeBytes: number }) {
    if (input.sizeBytes > MAX_RESOURCE_BYTES) throw badRequest('Resource is larger than 200 MB', 'too_large');
    const safe = input.filename.replace(/[^\w.\-]/g, '_').slice(-120) || 'file';
    const storageKey = `resources/${ownerId}/${randomUUID()}/${safe}`;
    return { storageKey, uploadUrl: await this.storage.presignPut(storageKey, input.contentType), method: 'PUT', headers: { 'Content-Type': input.contentType } };
  }

  async imageUpload(ownerId: string, contentType: string) {
    const ext = IMAGE_EXT[contentType];
    if (!ext) throw badRequest('Image must be JPEG, PNG or WebP', 'unsupported_type');
    const key = `images/${ownerId}/${randomUUID()}.${ext}`;
    return { key, uploadUrl: await this.storage.presignPut(key, contentType), method: 'PUT', headers: { 'Content-Type': contentType }, publicUrl: this.imageUrl(key) };
  }

  /** Stable public URL for course thumbnails/avatars (served by GET /api/media/images/...). */
  imageUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    return `${env().API_URL}/api/media/${key}`;
  }
}
