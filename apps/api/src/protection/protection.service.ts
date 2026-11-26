import { Injectable } from '@nestjs/common';
import { Prisma, type VideoAsset } from '../generated/prisma/client';
import type { AuthUser } from '../common/auth-context';
import { notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { env } from '../config/env';
import type { Playback } from '../media/video-provider';
import { cdnBase, cdnEnabled, cdnPolicyQuery } from './cdn-signer';
import { KEY_PLACEHOLDER, type Variant } from './hls-packager';
import { unwrapKey, sessionRef } from './media-keys';

const SESSION_HOURS = 6;

function variantsOf(raw: unknown): Variant[] {
  return Array.isArray(raw) ? (raw as Variant[]).filter((v) => v && typeof v.name === 'string' && /^[0-9a-z]+$/.test(v.name) && typeof v.playlist === 'string') : [];
}

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

  /**
   * index.m3u8: with several qualities, a master playlist (the player picks what the connection can carry); otherwise the
   * single-quality playlist itself (videos packaged before 2026-11-26).
   */
  async manifest(sessionId: string, user: AuthUser): Promise<string> {
    const s = await this.live(sessionId, user);
    const variants = variantsOf(s.asset.hlsVariants);
    if (variants.length < 2) return this.playlist(s, variants[0]?.playlist ?? s.asset.hlsPlaylist!);
    const base = `${env().API_URL}/api/playback/${s.id}/q`;
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS'];
    for (const v of [...variants].sort((a, b) => b.bandwidth - a.bandwidth)) {
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${Math.max(1, v.bandwidth)}${v.width && v.height ? `,RESOLUTION=${v.width}x${v.height}` : ''}`, `${base}/${v.name}/index.m3u8`);
    }
    return lines.join('\n') + '\n';
  }

  /** One quality's playlist with the key URI and signed segment links (CloudFront when configured, else S3). */
  async quality(sessionId: string, name: string, user: AuthUser): Promise<string> {
    const s = await this.live(sessionId, user);
    const v = variantsOf(s.asset.hlsVariants).find((x) => x.name === name);
    if (!v) throw notFound('Video');
    return this.playlist(s, v.playlist);
  }

  private async playlist(s: { id: string; expiresAt: Date; asset: { hlsPrefix: string | null } }, template: string): Promise<string> {
    const ttl = Math.max(60, Math.floor((s.expiresAt.getTime() - Date.now()) / 1000));
    const keyUri = `${env().API_URL}/api/playback/${s.id}/key`;
    const root = `hls/${s.asset.hlsPrefix}`;
    // CloudFront: one policy for every segment of this video until the session ends (docs/VIDEO_DELIVERY.md)
    const cdnQuery = cdnEnabled() ? cdnPolicyQuery(`${cdnBase()}/${root}/*`, s.expiresAt) : null;
    const lines = await Promise.all(template.split('\n').map(async (l) => {
      const m = /^\{\{SEG:((?:[0-9a-z]+\/)?seg_\d+\.ts)\}\}$/.exec(l.trim());
      if (m) return cdnQuery ? `${cdnBase()}/${root}/${m[1]}?${cdnQuery}` : this.storage.presignGet(`${root}/${m[1]}`, ttl);
      return l.replace(KEY_PLACEHOLDER, keyUri);
    }));
    return lines.join('\n');
  }

  async key(sessionId: string, user: AuthUser): Promise<Buffer> {
    const s = await this.live(sessionId, user);
    return unwrapKey(s.asset.hlsKey!);
  }


  /**
   * Super admin: package again every video made before adaptive playback (one quality), so learners on slow connections
   * get 720p/480p too. The current copy keeps playing until the new one is ready (it is only then replaced).
   */
  async repackageSingleQuality(): Promise<{ queued: number }> {
    const assets = await this.prisma.videoAsset.findMany({ where: { provider: 'local', status: 'ready', hlsStatus: 'ready', hlsVariants: { equals: Prisma.DbNull } }, select: { id: true } });
    for (const a of assets) await this.jobs.packageHls(a.id, { repackage: true });
    return { queued: assets.length };
  }

  /** Packaging progress for the admin page. */
  async status() {
    const rows = await this.prisma.videoAsset.groupBy({ by: ['hlsStatus'], where: { provider: 'local', status: 'ready' }, _count: { _all: true } });
    const singleQuality = await this.prisma.videoAsset.count({ where: { provider: 'local', status: 'ready', hlsStatus: 'ready', hlsVariants: { equals: Prisma.DbNull } } });
    return { enabled: env().PROTECTED_PLAYBACK, cdn: cdnEnabled(), renditions: env().HLS_RENDITIONS, singleQuality, counts: Object.fromEntries(rows.map((r) => [r.hlsStatus, r._count._all])) };
  }
}
