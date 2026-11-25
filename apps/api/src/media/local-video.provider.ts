import { videoKey } from '../common/storage-keys';
import { Injectable } from '@nestjs/common';
import type { VideoAsset } from '../generated/prisma/client';
import { badRequest } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { Playback, PLAYBACK_TTL_SEC, UploadTarget, VideoProvider } from './video-provider';

const EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

/** Private MinIO/S3 bucket: presigned PUT to upload, ffprobe job in the worker, presigned GET (5 min) to play. */
@Injectable()
export class LocalVideoProvider implements VideoProvider {
  readonly name = 'local' as const;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
  ) {}

  async createUpload(ownerId: string, opts: { filename: string; contentType: string; courseId?: string | null }): Promise<UploadTarget> {
    const ext = EXT[opts.contentType];
    if (!ext) throw badRequest('Video must be MP4, WebM or MOV', 'unsupported_type');
    const asset = await this.prisma.videoAsset.create({ data: { ownerId, provider: 'local', status: 'uploading' } });
    const storageKey = videoKey(ownerId, asset.id, ext, opts.courseId);
    await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { storageKey } });
    const ttl = 3600;
    return {
      assetId: asset.id,
      provider: 'local',
      uploadUrl: await this.storage.presignPut(storageKey, opts.contentType, ttl),
      method: 'PUT',
      headers: { 'Content-Type': opts.contentType },
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  async onUploaded(asset: VideoAsset) {
    if (!asset.storageKey || !(await this.storage.head(asset.storageKey))) {
      throw badRequest('The file has not been uploaded yet', 'upload_missing');
    }
    await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { status: 'processing', error: null } });
    await this.jobs.processVideo(asset.id);
  }

  async playbackUrl(asset: VideoAsset): Promise<Playback> {
    if (!asset.storageKey) throw badRequest('Video is not available', 'video_unavailable');
    return {
      url: await this.storage.presignGet(asset.storageKey, PLAYBACK_TTL_SEC),
      expiresAt: new Date(Date.now() + PLAYBACK_TTL_SEC * 1000).toISOString(),
      format: 'mp4',
      captionsUrl: asset.captionsKey ? await this.storage.presignGet(asset.captionsKey, PLAYBACK_TTL_SEC) : undefined,
    };
  }
}
