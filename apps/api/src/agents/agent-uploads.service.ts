import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Actor } from '../common/auth-context';
import { AuditService } from '../common/audit.service';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { resourceKey, videoKey } from '../common/storage-keys';
import { StorageService } from '../common/storage.service';
import { env } from '../config/env';
import { MAX_RESOURCE_BYTES, MediaService } from '../media/media.service';

const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export const MAX_VIDEO_BYTES = 20 * 1024 ** 3;
/** 64 MiB parts: a 2 GB recording is 32 parts; storage allows 10 000. */
export const PART_SIZE = 64 * 1024 * 1024;
export const partCount = (size: number, part = PART_SIZE) => Math.max(1, Math.ceil(size / part));

export interface UploadInput { kind: 'video' | 'resource'; filename: string; contentType: string; sizeBytes: number; sha256?: string; courseId?: string }

/**
 * Resumable uploads for AI agents (and any large file): multipart straight to storage with presigned part URLs,
 * resumable after a dropped connection (list what arrived, upload the rest), duplicate detection by SHA-256, size
 * check on completion. A video then goes through the normal processing (ffprobe, encrypted packaging).
 */
@Injectable()
export class AgentUploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  async create(a: Actor, input: UploadInput, agentTokenId: string | null) {
    const ownerId = a.user.id;
    const sha = input.sha256?.toLowerCase();
    if (input.kind === 'video') {
      if (env().VIDEO_PROVIDER === 'mux') throw badRequest('Video uploads through the agent API need the storage video provider', 'unsupported');
      if (!VIDEO_EXT[input.contentType]) throw badRequest('Video must be MP4, WebM or MOV', 'unsupported_type');
      if (input.sizeBytes > MAX_VIDEO_BYTES) throw badRequest('Video is larger than 20 GB', 'too_large');
    } else if (input.sizeBytes > MAX_RESOURCE_BYTES) {
      throw badRequest('File is larger than 200 MB', 'too_large');
    }
    let courseId: string | null = null;
    if (input.courseId) {
      const c = await this.prisma.course.findFirst({ where: { id: input.courseId, instructorId: ownerId }, select: { id: true } });
      if (!c) throw notFound('Course');
      courseId = c.id;
    }

    if (sha) {
      // Same content already uploaded by this instructor: reuse it instead of uploading again.
      const done = await this.prisma.uploadSession.findFirst({ where: { ownerId, sha256: sha, kind: input.kind, status: 'completed' }, orderBy: { completedAt: 'desc' } });
      if (done) {
        if (input.kind === 'resource' && (await this.storage.head(done.storageKey))) return { duplicate: true, id: done.id, kind: done.kind, storageKey: done.storageKey };
        if (input.kind === 'video' && done.assetId) {
          const asset = await this.prisma.videoAsset.findFirst({ where: { id: done.assetId, ownerId } });
          if (asset && asset.status !== 'failed') return { duplicate: true, id: done.id, kind: done.kind, assetId: asset.id, status: asset.status };
        }
      }
      const open = await this.prisma.uploadSession.findFirst({ where: { ownerId, sha256: sha, kind: input.kind, status: 'uploading', sizeBytes: BigInt(input.sizeBytes) }, orderBy: { createdAt: 'desc' } });
      if (open) return { ...this.view(open), resume: true };
    }

    const safe = input.filename.replace(/[^\w.\-]/g, '_').slice(-120) || 'file';
    let assetId: string | null = null;
    let storageKey: string;
    if (input.kind === 'video') {
      const asset = await this.prisma.videoAsset.create({ data: { ownerId, provider: 'local', status: 'uploading' } });
      assetId = asset.id;
      storageKey = videoKey(ownerId, asset.id, VIDEO_EXT[input.contentType]!, courseId);
      await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { storageKey } });
    } else {
      storageKey = resourceKey(ownerId, randomUUID(), safe, courseId);
    }
    const uploadId = await this.storage.createMultipart(storageKey, input.contentType);
    const row = await this.prisma.uploadSession.create({
      data: { ownerId, kind: input.kind, filename: input.filename.slice(0, 200), contentType: input.contentType, sizeBytes: BigInt(input.sizeBytes), sha256: sha ?? null, storageKey, uploadId, partSize: PART_SIZE, assetId, courseId, agentTokenId },
    });
    await this.audit.log({ actorId: ownerId, action: 'upload.started', targetType: input.kind === 'video' ? 'video_asset' : 'upload', targetId: assetId ?? row.id, ip: a.ip, meta: { filename: row.filename, sizeBytes: input.sizeBytes } });
    return this.view(row);
  }

  private async own(ownerId: string, id: string) {
    const u = await this.prisma.uploadSession.findFirst({ where: { id, ownerId } });
    if (!u) throw notFound('Upload');
    return u;
  }

  /** Presigned URLs for parts `from`..`from+count-1`, plus what already arrived (to resume). */
  async parts(ownerId: string, id: string, from: number, count: number) {
    const u = await this.own(ownerId, id);
    if (u.status !== 'uploading') throw conflict(`This upload is ${u.status}`, 'upload_closed');
    const total = partCount(Number(u.sizeBytes), u.partSize);
    const uploaded = await this.storage.listParts(u.storageKey, u.uploadId);
    const last = Math.min(total, from + count - 1);
    const urls: { partNumber: number; url: string; size: number }[] = [];
    for (let n = Math.max(1, from); n <= last; n++) {
      const size = n < total ? u.partSize : Number(u.sizeBytes) - u.partSize * (total - 1);
      urls.push({ partNumber: n, size, url: await this.storage.presignPart(u.storageKey, u.uploadId, n) });
    }
    return { ...this.view(u), uploaded: uploaded.map((p) => ({ partNumber: p.partNumber, size: p.size })), urls };
  }

  async complete(a: Actor, id: string) {
    const u = await this.own(a.user.id, id);
    if (u.status === 'completed') return this.result(a, u);
    if (u.status !== 'uploading') throw conflict(`This upload is ${u.status}`, 'upload_closed');
    const total = partCount(Number(u.sizeBytes), u.partSize);
    const parts = await this.storage.listParts(u.storageKey, u.uploadId);
    const have = new Set(parts.map((p) => p.partNumber));
    const missing = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !have.has(n));
    const bytes = parts.filter((p) => p.partNumber <= total).reduce((s, p) => s + p.size, 0);
    if (missing.length || bytes !== Number(u.sizeBytes)) {
      throw badRequest(missing.length ? `Parts not uploaded yet: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''}` : `Uploaded ${bytes} bytes, expected ${u.sizeBytes}`, 'upload_incomplete', { missing, bytes, expected: Number(u.sizeBytes) });
    }
    await this.storage.completeMultipart(u.storageKey, u.uploadId, parts.filter((p) => p.partNumber <= total));
    const head = await this.storage.head(u.storageKey);
    if (!head || head.size !== Number(u.sizeBytes)) throw badRequest('The stored file does not have the expected size', 'upload_incomplete');
    const done = await this.prisma.uploadSession.update({ where: { id: u.id }, data: { status: 'completed', completedAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: 'upload.completed', targetType: u.kind === 'video' ? 'video_asset' : 'upload', targetId: u.assetId ?? u.id, ip: a.ip, meta: { filename: u.filename, sizeBytes: Number(u.sizeBytes) } });
    return this.result(a, done);
  }

  async abort(a: Actor, id: string) {
    const u = await this.own(a.user.id, id);
    if (u.status !== 'uploading') return this.view(u);
    await this.storage.abortMultipart(u.storageKey, u.uploadId);
    if (u.assetId) await this.prisma.videoAsset.updateMany({ where: { id: u.assetId, status: 'uploading' }, data: { status: 'failed', error: 'Upload cancelled' } });
    return this.view(await this.prisma.uploadSession.update({ where: { id: u.id }, data: { status: 'aborted' } }));
  }

  /** After completion: a video starts processing (same path as the studio); a file returns its storage key. */
  private async result(a: Actor, u: { id: string; kind: string; assetId: string | null; storageKey: string }) {
    if (u.kind === 'video' && u.assetId) {
      const video = await this.media.completeVideoUpload(a, u.assetId);
      return { id: u.id, kind: u.kind, status: 'completed', assetId: u.assetId, video };
    }
    return { id: u.id, kind: u.kind, status: 'completed', storageKey: u.storageKey };
  }

  private view(u: { id: string; kind: string; filename: string; sizeBytes: bigint; partSize: number; status: string; assetId: string | null; storageKey: string }) {
    return { id: u.id, kind: u.kind, filename: u.filename, sizeBytes: Number(u.sizeBytes), partSize: u.partSize, partCount: partCount(Number(u.sizeBytes), u.partSize), status: u.status, assetId: u.assetId, storageKey: u.kind === 'resource' ? u.storageKey : undefined };
  }
}
