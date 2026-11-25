import { Injectable } from '@nestjs/common';
import type { VideoAsset } from '../generated/prisma/client';
import type { AuthUser } from '../common/auth-context';
import { notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { env } from '../config/env';
import type { Playback } from '../media/video-provider';
import { KEY_PLACEHOLDER } from './hls-packager';
import { unwrapKey, sessionRef } from './media-keys';

const SESSION_HOURS = 6;

/**
 * Content protection (owner 2026-11-25, adapted from the Insurance Knowledge Hub): enrolled learners watch encrypted HLS
 * through a playback session bound to them, the video and a time window. The manifest and the key are served only to the
 * signed-in owner of a live session; segment links expire with it. This stops casual downloading and link sharing; it
 * can't stop screen recording (no web player can). No visible watermark on videos (owner, 2026-11-25).
 */
@Injectable()
export class ProtectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
  ) {}

  /** Protected playback if the video is packaged; otherwise null (the caller falls back to the signed MP4) and packaging is queued. */
  async session(asset: VideoAsset, user: { id: string }, ctx: { lectureId?: string; ip?: string | null; userAgent?: string | null }): Promise<Playback | null> {
    if (!env().PROTECTED_PLAYBACK || asset.provider !== 'local') return null;
    if (asset.hlsStatus !== 'ready' || !asset.hlsPlaylist || !asset.hlsKey) {
      if (asset.status === 'ready' && asset.hlsStatus === 'none') {
        await this.prisma.videoAsset.updateMany({ where: { id: asset.id, hlsStatus: 'none' }, data: { hlsStatus: 'queued' } });
        // Queueing must never break playback: the learner gets the signed file meanwhile.
        try { await this.jobs.packageHls(asset.id); } catch { /* the worker's start-up backfill picks it up */ }
      }
      return null;
    }
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
    const s = await this.prisma.playbackSession.create({
      data: { ref: sessionRef(), userId: user.id, assetId: asset.id, lectureId: ctx.lectureId ?? null, ip: ctx.ip ?? null, userAgent: ctx.userAgent?.slice(0, 300) ?? null, expiresAt },
    });
    return {
      url: `${env().API_URL}/api/playback/${s.id}/index.m3u8`,
      expiresAt: expiresAt.toISOString(),
      format: 'hls',
      protected: true,
      captionsUrl: asset.captionsKey ? await this.storage.presignGet(asset.captionsKey, SESSION_HOURS * 3600) : undefined,
    };
  }

  /** The session must exist, be live, and belong to the signed-in person; anything else is a 404 (no probing). */
  private async live(sessionId: string, user: AuthUser) {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw notFound('Video');
    const s = await this.prisma.playbackSession.findUnique({ where: { id: sessionId }, include: { asset: true } });
    if (!s || s.userId !== user.id || s.expiresAt < new Date() || s.asset.hlsStatus !== 'ready') throw notFound('Video');
    return s;
  }

  async manifest(sessionId: string, user: AuthUser): Promise<string> {
    const s = await this.live(sessionId, user);
    const ttl = Math.max(60, Math.floor((s.expiresAt.getTime() - Date.now()) / 1000));
    const keyUri = `${env().API_URL}/api/playback/${s.id}/key`;
    const lines = await Promise.all(s.asset.hlsPlaylist!.split('\n').map(async (l) => {
      const m = /^\{\{SEG:(seg_\d+\.ts)\}\}$/.exec(l.trim());
      if (m) return this.storage.presignGet(`hls/${s.asset.hlsPrefix}/${m[1]}`, ttl);
      return l.replace(KEY_PLACEHOLDER, keyUri);
    }));
    return lines.join('\n');
  }

  async key(sessionId: string, user: AuthUser): Promise<Buffer> {
    const s = await this.live(sessionId, user);
    return unwrapKey(s.asset.hlsKey!);
  }


  /** Packaging progress for the admin page. */
  async status() {
    const rows = await this.prisma.videoAsset.groupBy({ by: ['hlsStatus'], where: { provider: 'local', status: 'ready' }, _count: { _all: true } });
    return { enabled: env().PROTECTED_PLAYBACK, counts: Object.fromEntries(rows.map((r) => [r.hlsStatus, r._count._all])) };
  }
}
