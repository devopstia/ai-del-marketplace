import { Injectable } from '@nestjs/common';
import { Prisma, type HelpVideo, type VideoAsset } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { MediaService } from '../media/media.service';

/** Help video categories, in display order (owner 2026-11-25). */
export const HELP_CATEGORIES = [
  ['getting-started', 'Getting started', 'Find your way around DEL.'],
  ['learning', 'Learning on DEL', 'The course player, notes, quizzes and certificates.'],
  ['buying', 'Buying and payments', 'Cart, checkout, deals, receipts and refunds.'],
  ['teaching', 'Teaching on DEL', 'For instructors: the studio, courses, sales and payouts.'],
  ['account', 'Your account and help', 'Settings, the app on your devices, and getting support.'],
] as const;
export const HELP_CATEGORY_KEYS = HELP_CATEGORIES.map(([k]) => k) as [string, ...string[]];
export const HELP_AUDIENCES = ['everyone', 'students', 'instructors'] as const;

const PLAY_TTL = 3600;
type Row = HelpVideo & { videoAsset: VideoAsset | null };
export interface Chapter { t: number; title: string }

export interface HelpInput {
  title: string;
  summary: string;
  audience: (typeof HELP_AUDIENCES)[number];
  category: string;
  sort?: number;
  videoAssetId?: string | null;
  coverKey?: string | null;
  chapters?: Chapter[] | null;
  published?: boolean;
}

@Injectable()
export class HelpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  private view(v: Row) {
    return {
      slug: v.slug,
      title: v.title,
      summary: v.summary,
      audience: v.audience,
      category: v.category,
      sort: v.sort,
      durationSec: v.videoAsset?.durationSec ?? 0,
      coverUrl: this.media.imageUrl(v.coverKey),
      hasCaptions: !!v.videoAsset?.captionsKey,
    };
  }

  private watchable = { published: true, videoAsset: { status: 'ready' as const } };

  /** Public: published videos whose file is ready, grouped by category. */
  async list() {
    const rows = await this.prisma.helpVideo.findMany({ where: this.watchable, include: { videoAsset: true }, orderBy: [{ sort: 'asc' }, { title: 'asc' }] });
    return {
      categories: HELP_CATEGORIES.map(([key, name, description]) => ({ key, name, description, items: rows.filter((r) => r.category === key).map((r) => this.view(r)) })).filter((c) => c.items.length),
      total: rows.length,
    };
  }

  /** Public: one video with a playback link (1 hour), its chapters, and what to watch next. */
  async one(slug: string) {
    const v = await this.prisma.helpVideo.findFirst({ where: { slug, ...this.watchable }, include: { videoAsset: true } });
    if (!v || !v.videoAsset) throw notFound('Help video');
    const all = await this.prisma.helpVideo.findMany({ where: this.watchable, include: { videoAsset: true }, orderBy: [{ sort: 'asc' }, { title: 'asc' }] });
    const order = HELP_CATEGORY_KEYS;
    all.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.sort - b.sort);
    const i = all.findIndex((x) => x.id === v.id);
    const next = [...all.slice(i + 1), ...all.slice(0, i)].slice(0, 4);
    return { ...this.view(v), chapters: this.chapters(v.chapters), categoryName: HELP_CATEGORIES.find(([k]) => k === v.category)?.[1] ?? v.category, playback: await this.playback(v.videoAsset), next: next.map((n) => this.view(n)) };
  }

  private chapters(raw: unknown): Chapter[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((c): c is Chapter => !!c && typeof c.t === 'number' && typeof c.title === 'string').map((c) => ({ t: Math.max(0, c.t), title: c.title.slice(0, 80) }));
  }

  private async playback(a: VideoAsset) {
    if (a.provider === 'mux') return this.media.playback(a, null);
    if (!a.storageKey) throw notFound('Help video');
    return {
      url: await this.storage.presignGet(a.storageKey, PLAY_TTL),
      format: 'mp4' as const,
      expiresAt: new Date(Date.now() + PLAY_TTL * 1000).toISOString(),
      captionsUrl: a.captionsKey ? await this.storage.presignGet(a.captionsKey, PLAY_TTL) : undefined,
    };
  }

  // ---- Admin ----

  async adminList() {
    const rows = await this.prisma.helpVideo.findMany({ include: { videoAsset: true }, orderBy: [{ category: 'asc' }, { sort: 'asc' }] });
    rows.sort((x, y) => HELP_CATEGORY_KEYS.indexOf(x.category) - HELP_CATEGORY_KEYS.indexOf(y.category) || x.sort - y.sort);
    return {
      categories: HELP_CATEGORIES.map(([key, name]) => ({ key, name })),
      items: rows.map((r) => ({ ...this.view(r), published: r.published, videoStatus: r.videoAsset?.status ?? null, chapters: this.chapters(r.chapters), updatedAt: r.updatedAt })),
    };
  }

  /** Admin preview of any video (published or not). */
  async adminPreview(slug: string) {
    const v = await this.prisma.helpVideo.findUnique({ where: { slug }, include: { videoAsset: true } });
    if (!v) throw notFound('Help video');
    if (!v.videoAsset || v.videoAsset.status !== 'ready') throw badRequest('The video file is not ready yet', 'video_not_ready');
    return this.playback(v.videoAsset);
  }

  private async checkRefs(a: Actor, input: Partial<HelpInput>) {
    if (input.videoAssetId) {
      const asset = await this.prisma.videoAsset.findUnique({ where: { id: input.videoAssetId } });
      if (!asset || asset.ownerId !== a.user.id) throw badRequest('Upload the video first', 'video_not_found');
    }
    if (input.coverKey && !input.coverKey.startsWith(`images/${a.user.id}/`)) throw badRequest('Upload the cover first', 'cover_not_found');
  }

  /** Create or update by slug (used by the admin page and by video-academy's publish tool). */
  async upsert(a: Actor, slug: string, input: HelpInput) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw badRequest('Use lowercase letters, numbers and dashes for the address', 'bad_slug');
    await this.checkRefs(a, input);
    const data: Prisma.HelpVideoUncheckedUpdateInput & Prisma.HelpVideoUncheckedCreateInput = {
      slug,
      title: input.title.trim(), summary: input.summary.trim(), audience: input.audience, category: input.category, sort: input.sort ?? 0,
      ...(input.videoAssetId !== undefined ? { videoAssetId: input.videoAssetId } : {}),
      ...(input.coverKey !== undefined ? { coverKey: input.coverKey } : {}),
      ...(input.chapters !== undefined ? { chapters: input.chapters ? (input.chapters as unknown as Prisma.InputJsonValue) : Prisma.DbNull } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    };
    const v = await this.prisma.helpVideo.upsert({ where: { slug }, create: data, update: data, include: { videoAsset: true } });
    await this.audit.log({ actorId: a.user.id, action: 'help.video_saved', targetType: 'help_video', targetId: v.id, ip: a.ip, meta: { slug, published: v.published } });
    return { ...this.view(v), published: v.published };
  }

  async setPublished(a: Actor, slug: string, published: boolean) {
    const v = await this.prisma.helpVideo.findUnique({ where: { slug }, include: { videoAsset: true } });
    if (!v) throw notFound('Help video');
    if (published && v.videoAsset?.status !== 'ready') throw badRequest('Add a video that has finished processing before publishing', 'video_not_ready');
    await this.prisma.helpVideo.update({ where: { id: v.id }, data: { published } });
    await this.audit.log({ actorId: a.user.id, action: published ? 'help.video_published' : 'help.video_unpublished', targetType: 'help_video', targetId: v.id, ip: a.ip, meta: { slug } });
    return { slug, published };
  }

  async remove(a: Actor, slug: string) {
    const v = await this.prisma.helpVideo.findUnique({ where: { slug } });
    if (!v) throw notFound('Help video');
    await this.prisma.helpVideo.delete({ where: { id: v.id } });
    await this.audit.log({ actorId: a.user.id, action: 'help.video_deleted', targetType: 'help_video', targetId: v.id, ip: a.ip, meta: { slug } });
    return { ok: true };
  }
}
