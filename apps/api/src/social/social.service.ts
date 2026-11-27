import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { splitTitle } from '../covers/cover-render';
import { chipsFrom, courseBannerInput, DEFAULT_SOCIAL, mergeSettings, siteBannerInput, type SocialSettings } from './share-inputs';
import { bannerImage, type BannerInput, type EncodedImage, normaliseUpload, SHARE_H, SHARE_W, type ShareCard } from './share-render';
import { defaultTemplateFor, type Family, FAMILIES, FAMILY_NAMES, SHARE_TEMPLATES, templateByKey } from './share-templates';

/** Version of the banner drawing code: bump it to redraw every banner after a renderer change. */
export const SHARE_RENDER_VERSION = 's1';
const SETTINGS_KEY = 'social_sharing';
const SITE_KEY = 'social_site_banner';

export interface ShareImage { path: string; width: number; height: number; type: string; alt: string }
type CourseRow = { id: string; title: string; subtitle: string; priceCents: number; status: string; archivedAt: Date | null; shareFamily: string | null; shareTemplate: string | null; shareHeadline: string | null; shareUploadKey: string | null; shareKey: string | null; shareHash: string | null; category: { slug: string; name: string } | null };

const typeOf = (key: string) => (key.endsWith('.png') ? 'image/png' : 'image/jpeg');
/** Public path on the web host (apps/web proxies /media/images/* to the API; same files, same cache rules). */
export const sharePath = (key: string) => `/media/${key}`;
const hashOf = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);
const isPublic = (c: { status: string; archivedAt: Date | null }) => c.status === 'published' && !c.archivedAt;

/**
 * Sharing banners and link-preview defaults (owner 2026-11-28, docs/SOCIAL_SHARING.md). Banners are drawn on the server
 * (share-render.ts), stored under images/social/ with the hash of everything drawn in their name, and served publicly with
 * long cache headers: a change gives a new URL, so no CDN invalidation is ever needed. Only PUBLISHED courses get a stored
 * banner; drafts are previewed through signed-in endpoints and never written to the public prefix.
 */
@Injectable()
export class SocialService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Social');
  private timer?: NodeJS.Timeout;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Draw missing or outdated banners at start-up, then every minute (titles, prices and course lists change elsewhere). */
  onModuleInit() {
    if (process.env.NODE_ENV === 'test' && !process.env.SOCIAL_ON_START) return;
    const run = () => void this.refreshAll().catch((e) => this.log.error(`banner refresh failed: ${(e as Error).message}`));
    setTimeout(run, 5_000).unref();
    this.timer = setInterval(run, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ---------- settings ----------
  async settings(): Promise<SocialSettings> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: SETTINGS_KEY } });
    return mergeSettings(row?.value);
  }

  private async saveSettings(s: SocialSettings) {
    const value = JSON.parse(JSON.stringify(s));
    await this.prisma.platformSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
  }

  /** Super Admin view: settings, defaults, families and templates. */
  async adminView() {
    const s = await this.settings();
    const site = await this.ensureSite();
    return {
      settings: s,
      defaults: DEFAULT_SOCIAL,
      families: FAMILIES.map((key) => ({ key, name: FAMILY_NAMES[key] })),
      templates: SHARE_TEMPLATES.map((t) => ({ key: t.key, name: t.name, topics: t.topics, accent: t.a, enabled: !s.disabledTemplates.includes(t.key) })),
      siteImage: site,
      siteUploadUrl: s.siteUploadKey ? sharePath(s.siteUploadKey) : null,
    };
  }

  async updateSettings(a: Actor, patch: Partial<Omit<SocialSettings, 'siteUploadKey'>>) {
    const before = await this.settings();
    const next = mergeSettings({ ...before, ...patch, site: { ...before.site, ...(patch.site ?? {}) }, siteUploadKey: before.siteUploadKey });
    await this.saveSettings(next);
    const changed = Object.keys(patch).filter((k) => JSON.stringify((before as never)[k]) !== JSON.stringify((next as never)[k]));
    await this.audit.log({ actorId: a.user.id, action: 'social.settings_updated', targetType: 'platform_setting', targetId: SETTINGS_KEY, ip: a.ip, meta: { changed } });
    const refreshed = await this.refreshAll();
    return { ...(await this.adminView()), refreshed };
  }

  async restoreDefaults(a: Actor) {
    const before = await this.settings();
    await this.saveSettings({ ...DEFAULT_SOCIAL, siteUploadKey: null });
    await this.audit.log({ actorId: a.user.id, action: 'social.settings_restored', targetType: 'platform_setting', targetId: SETTINGS_KEY, ip: a.ip, meta: { hadUpload: !!before.siteUploadKey } });
    await this.refreshAll();
    return this.adminView();
  }

  async setSiteUpload(a: Actor, file: Buffer | null) {
    const s = await this.settings();
    let key: string | null = null;
    if (file) {
      const img = await this.normalise(file);
      key = `images/social/upload-site-${hashOf(img.buf.toString('base64'))}.${img.ext}`;
      await this.storage.put(key, img.buf, img.type);
    }
    await this.saveSettings({ ...s, siteUploadKey: key });
    await this.audit.log({ actorId: a.user.id, action: file ? 'social.site_banner_uploaded' : 'social.site_banner_upload_removed', targetType: 'platform_setting', targetId: SETTINGS_KEY, ip: a.ip, meta: { key } });
    await this.ensureSite();
    return this.adminView();
  }

  private async normalise(buf: Buffer): Promise<EncodedImage> {
    try { return await normaliseUpload(buf); } catch (e) { throw badRequest((e as Error).message, 'share_banner_invalid'); }
  }

  // ---------- real course cards (marketplace family) ----------
  private card(c: { title: string; priceCents: number; category: { slug: string; name: string } | null }, disabled: string[]): ShareCard {
    return { title: splitTitle(c.title).main, line: c.category?.name ?? 'Online course', accent: defaultTemplateFor(c.category?.slug, disabled).a, free: c.priceCents === 0 };
  }
  private readonly cardSelect = { id: true, title: true, priceCents: true, category: { select: { slug: true, name: true } } } as const;
  private publicWhere = { status: 'published' as const, archivedAt: null };

  /** Top published courses: featured first (the admin's order), then the newest. Never drafts. */
  private async topCards(disabled: string[], n = 3, exclude: string[] = []) {
    const rows = await this.prisma.course.findMany({ where: { ...this.publicWhere, id: { notIn: exclude } }, orderBy: [{ featuredAt: { sort: 'desc', nulls: 'last' } }, { publishedAt: 'desc' }], take: n, select: this.cardSelect });
    return rows.map((r) => this.card(r, disabled));
  }

  /** Behind a course's own card: its related courses, then its topic's, then the top ones. Published only. */
  private async otherCards(courseId: string, categorySlug: string | null | undefined, disabled: string[]) {
    const related = await this.prisma.courseRelated.findMany({ where: { courseId, relatedCourse: this.publicWhere }, orderBy: { position: 'asc' }, take: 2, select: { relatedCourse: { select: this.cardSelect } } });
    const picked = related.map((r) => r.relatedCourse);
    if (picked.length < 2 && categorySlug) {
      picked.push(...(await this.prisma.course.findMany({ where: { ...this.publicWhere, category: { slug: categorySlug }, id: { notIn: [courseId, ...picked.map((p) => p.id)] } }, orderBy: { publishedAt: 'desc' }, take: 2 - picked.length, select: this.cardSelect })));
    }
    if (picked.length < 2) {
      picked.push(...(await this.prisma.course.findMany({ where: { ...this.publicWhere, id: { notIn: [courseId, ...picked.map((p) => p.id)] } }, orderBy: [{ featuredAt: { sort: 'desc', nulls: 'last' } }, { publishedAt: 'desc' }], take: 2 - picked.length, select: this.cardSelect })));
    }
    return picked.map((p) => this.card(p, disabled));
  }

  // ---------- site banner ----------
  async siteInput(s: SocialSettings, family: Family = s.family) {
    return siteBannerInput(s, family, family === 'marketplace' ? await this.topCards(s.disabledTemplates) : []);
  }

  /** The current site banner, drawn (or the custom upload), stored under a hashed name. */
  async ensureSite(): Promise<ShareImage> {
    const s = await this.settings();
    const alt = `${s.title}`;
    if (s.siteUploadKey) return { path: sharePath(s.siteUploadKey), width: SHARE_W, height: SHARE_H, type: typeOf(s.siteUploadKey), alt };
    const input = await this.siteInput(s);
    const hash = hashOf([SHARE_RENDER_VERSION, input]);
    const row = await this.prisma.platformSetting.findUnique({ where: { key: SITE_KEY } });
    const cur = row?.value as { key?: string; hash?: string } | undefined;
    if (cur?.key && cur.hash === hash) return { path: sharePath(cur.key), width: SHARE_W, height: SHARE_H, type: typeOf(cur.key), alt };
    // The site banner is always a JPEG, so pages that point at /og/site.jpg can state its type.
    const img = await bannerImage(input, { jpegOnly: true });
    const key = `images/social/site-${hash}.${img.ext}`;
    await this.storage.put(key, img.buf, img.type);
    const value = { key, hash };
    await this.prisma.platformSetting.upsert({ where: { key: SITE_KEY }, create: { key: SITE_KEY, value }, update: { value } });
    return { path: sharePath(key), width: SHARE_W, height: SHARE_H, type: img.type, alt };
  }

  /** Public: the defaults every page without its own preview uses. */
  async publicSite() {
    const s = await this.settings();
    return { title: s.title, description: s.description, image: await this.ensureSite() };
  }

  // ---------- course banners ----------
  private readonly courseSelect = {
    id: true, title: true, subtitle: true, priceCents: true, status: true, archivedAt: true, objectives: true,
    shareFamily: true, shareTemplate: true, shareHeadline: true, shareUploadKey: true, shareKey: true, shareHash: true,
    category: { select: { slug: true, name: true } },
    sections: { orderBy: { position: 'asc' as const }, select: { title: true, lectures: { select: { durationSec: true } } } },
  };

  /** The family and template a course uses: its own choice when still enabled, else the platform defaults. */
  resolve(c: Pick<CourseRow, 'shareFamily' | 'shareTemplate' | 'category'>, s: SocialSettings) {
    const family = FAMILIES.includes(c.shareFamily as Family) ? (c.shareFamily as Family) : s.courseFamily;
    const own = templateByKey(c.shareTemplate);
    const template = own && !s.disabledTemplates.includes(own.key) ? own : defaultTemplateFor(c.category?.slug, s.disabledTemplates);
    return { family, template };
  }

  async courseInput(courseId: string, s: SocialSettings, override: { family?: Family; template?: string; headline?: string | null } = {}): Promise<BannerInput | null> {
    const c = await this.prisma.course.findUnique({ where: { id: courseId }, select: this.courseSelect });
    if (!c) return null;
    const r = this.resolve({ shareFamily: override.family ?? c.shareFamily, shareTemplate: override.template ?? c.shareTemplate, category: c.category }, s);
    const lectures = c.sections.flatMap((x) => x.lectures);
    return courseBannerInput({
      title: c.title,
      subtitle: c.subtitle,
      headline: override.headline !== undefined ? override.headline : c.shareHeadline,
      topic: c.category?.name ?? null,
      free: c.priceCents === 0,
      lessons: lectures.length,
      durationSec: lectures.reduce((n, l) => n + l.durationSec, 0),
      others: r.family === 'marketplace' ? await this.otherCards(c.id, c.category?.slug, s.disabledTemplates) : [],
      chips: r.family === 'enterprise' ? chipsFrom([c.title, c.subtitle, ...c.objectives], c.sections.map((x) => x.title)) : [],
    }, r.family, r.template);
  }

  /**
   * Make sure a published course's stored banner matches what it should show; draws and stores it when anything
   * changed. Unpublished, archived or missing courses get nothing (and their old banner is no longer referenced).
   */
  async ensureCourse(courseId: string, s?: SocialSettings): Promise<ShareImage | null> {
    const c = await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, status: true, archivedAt: true, shareUploadKey: true, shareKey: true, shareHash: true } });
    if (!c || !isPublic(c)) return null;
    const alt = `${c.title}: a course on DevOps Easy Learning`;
    if (c.shareUploadKey) {
      if (c.shareKey !== c.shareUploadKey) await this.prisma.course.update({ where: { id: c.id }, data: { shareKey: c.shareUploadKey, shareHash: `upload:${c.shareUploadKey}` } });
      return { path: sharePath(c.shareUploadKey), width: SHARE_W, height: SHARE_H, type: typeOf(c.shareUploadKey), alt };
    }
    const input = await this.courseInput(courseId, s ?? (await this.settings()));
    if (!input) return null;
    const hash = hashOf([SHARE_RENDER_VERSION, input]);
    if (c.shareKey && c.shareHash === hash) return { path: sharePath(c.shareKey), width: SHARE_W, height: SHARE_H, type: typeOf(c.shareKey), alt };
    const img = await bannerImage(input);
    const key = `images/social/${c.id}-${hash}.${img.ext}`;
    await this.storage.put(key, img.buf, img.type);
    await this.prisma.course.update({ where: { id: c.id }, data: { shareKey: key, shareHash: hash } });
    return { path: sharePath(key), width: SHARE_W, height: SHARE_H, type: img.type, alt };
  }

  /** The stored banner of a published course for its page's metadata (drawn on first use). Null for anything not public. */
  async courseImage(c: { id: string; title: string; status: string; archivedAt: Date | null; shareKey: string | null; shareUploadKey?: string | null }): Promise<ShareImage | null> {
    if (!isPublic(c)) return null;
    if (c.shareKey) return { path: sharePath(c.shareKey), width: SHARE_W, height: SHARE_H, type: typeOf(c.shareKey), alt: `${c.title}: a course on DevOps Easy Learning` };
    return this.ensureCourse(c.id).catch((e) => { this.log.error(`banner for ${c.id} failed: ${(e as Error).message}`); return null; });
  }

  async refreshAll() {
    const s = await this.settings();
    await this.ensureSite();
    const rows = await this.prisma.course.findMany({ where: this.publicWhere, select: { id: true, shareKey: true } });
    let n = 0;
    for (const r of rows) {
      const img = await this.ensureCourse(r.id, s);
      if (img && (!r.shareKey || img.path !== sharePath(r.shareKey))) n++;
    }
    if (n) this.log.log(`drew ${n} course sharing banners`);
    return n;
  }

  // ---------- per-course choices (instructor: own courses; super admin: any) ----------
  private async courseFor(a: Actor, courseId: string, asAdmin: boolean) {
    const c = await this.prisma.course.findFirst({ where: { id: courseId, ...(asAdmin ? {} : { instructorId: a.user.id }) }, select: { id: true, title: true, status: true, archivedAt: true, shareFamily: true, shareTemplate: true, shareHeadline: true, shareUploadKey: true, shareKey: true, category: { select: { slug: true, name: true } } } });
    if (!c) throw notFound('Course');
    return c;
  }

  async courseView(a: Actor, courseId: string, asAdmin = false) {
    const c = await this.courseFor(a, courseId, asAdmin);
    const s = await this.settings();
    const r = this.resolve(c, s);
    return {
      course: { id: c.id, title: c.title, published: isPublic(c) },
      choice: { family: c.shareFamily, template: c.shareTemplate, headline: c.shareHeadline, uploadUrl: c.shareUploadKey ? sharePath(c.shareUploadKey) : null },
      effective: { family: r.family, template: r.template.key },
      defaults: { family: s.courseFamily, template: defaultTemplateFor(c.category?.slug, s.disabledTemplates).key },
      families: FAMILIES.map((key) => ({ key, name: FAMILY_NAMES[key] })),
      templates: SHARE_TEMPLATES.filter((t) => !s.disabledTemplates.includes(t.key)).map((t) => ({ key: t.key, name: t.name, accent: t.a })),
      imageUrl: isPublic(c) ? (await this.ensureCourse(c.id, s))?.path ?? null : null,
    };
  }

  async setCourseChoice(a: Actor, courseId: string, b: { family?: Family | null; template?: string | null; headline?: string | null }, asAdmin = false) {
    const c = await this.courseFor(a, courseId, asAdmin);
    const s = await this.settings();
    if (b.template && (!templateByKey(b.template) || s.disabledTemplates.includes(b.template))) throw badRequest('Pick one of the available banner templates', 'share_template');
    const data = {
      ...(b.family !== undefined ? { shareFamily: b.family } : {}),
      ...(b.template !== undefined ? { shareTemplate: b.template } : {}),
      ...(b.headline !== undefined ? { shareHeadline: b.headline?.trim() || null } : {}),
    };
    await this.prisma.course.update({ where: { id: c.id }, data });
    await this.audit.log({ actorId: a.user.id, action: 'course.share_banner_changed', targetType: 'course', targetId: c.id, ip: a.ip, meta: { from: { family: c.shareFamily, template: c.shareTemplate, headline: c.shareHeadline }, to: data, asAdmin } });
    await this.ensureCourse(c.id);
    return this.courseView(a, courseId, asAdmin);
  }

  async setCourseUpload(a: Actor, courseId: string, file: Buffer | null, asAdmin = false) {
    const c = await this.courseFor(a, courseId, asAdmin);
    let key: string | null = null;
    if (file) {
      const img = await this.normalise(file);
      key = `images/social/upload-${c.id}-${hashOf(img.buf.toString('base64'))}.${img.ext}`;
      await this.storage.put(key, img.buf, img.type);
    }
    // A removed upload: the drawn banner comes back (clearing shareKey forces it to be drawn).
    await this.prisma.course.update({ where: { id: c.id }, data: { shareUploadKey: key, ...(key ? {} : { shareKey: null, shareHash: null }) } });
    await this.audit.log({ actorId: a.user.id, action: file ? 'course.share_banner_uploaded' : 'course.share_banner_upload_removed', targetType: 'course', targetId: c.id, ip: a.ip, meta: { key, asAdmin } });
    await this.ensureCourse(c.id);
    return this.courseView(a, courseId, asAdmin);
  }

  // ---------- previews (never stored) ----------
  async previewSite(draft: Partial<SocialSettings>, family: Family) {
    const s = mergeSettings({ ...(await this.settings()), ...draft });
    return bannerImage(await this.siteInput(s, family), { jpegOnly: true });
  }

  async previewCourse(a: Actor, courseId: string, o: { family?: Family; template?: string; headline?: string | null }, asAdmin = false) {
    await this.courseFor(a, courseId, asAdmin);
    const s = await this.settings();
    if (o.template && !templateByKey(o.template)) throw badRequest('Unknown template', 'share_template');
    const input = await this.courseInput(courseId, s, o);
    if (!input) throw notFound('Course');
    return bannerImage(input);
  }
}
