import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { MediaService } from '../media/media.service';
import { coverPng, COVER_W } from './cover-render';
import { BUILT_IN_TEMPLATES, FALLBACK_TEMPLATE_KEY, groupOf, LAYOUTS, MOTIFS, PALETTES, type Layout, type Motif, type Palette } from './cover-templates';

/** Version of the drawing code: bump it to regenerate every cover after a renderer change. */
const RENDER_VERSION = 'r1';
const HEX = /^#[0-9a-f]{6}$/i;

export interface TemplateRow { id: string; key: string; name: string; layout: string; motif: string; palette: unknown; topics: string[]; group: string; active: boolean; sort: number; builtIn: boolean }
export interface TemplateInput { name: string; layout: Layout; motif: Motif; palette: Palette; topics: string[]; active?: boolean; sort?: number }

/**
 * Standard course covers (owner brief 2026-11-25): every course uses a platform template; its cover is a PNG generated on
 * the server from the template and the course title, stored under images/covers/ and served like any course image. Covers
 * are regenerated whenever the title, topic or template changes. Custom cover uploads are not used.
 */
@Injectable()
export class CoversService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Covers');
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  /** Insert missing built-in templates, then give every course without a cover one. Safe to run on every start. */
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test' && !process.env.COVERS_ON_START) return;
    try {
      await this.installBuiltIns();
      const n = await this.backfill();
      if (n) this.log.log(`generated ${n} course covers`);
    } catch (e) {
      this.log.error(`cover start-up failed: ${(e as Error).message}`);
    }
    // Courses created outside the API (seed, catalogue import) get their cover within a minute.
    this.timer = setInterval(() => void this.backfill().catch((e) => this.log.error((e as Error).message)), 60_000);
    this.timer.unref();
  }

  private timer?: NodeJS.Timeout;
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async installBuiltIns() {
    const have = new Set((await this.prisma.coverTemplate.findMany({ select: { key: true } })).map((t) => t.key));
    const missing = BUILT_IN_TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => !have.has(t.key));
    if (!missing.length) return 0;
    await this.prisma.coverTemplate.createMany({
      data: missing.map(({ t, i }) => ({ key: t.key, name: t.name, layout: t.layout, motif: t.motif, palette: { ...PALETTES[t.palette] }, topics: t.topics, group: groupOf(t.motif), sort: (i + 1) * 10, builtIn: true })),
      skipDuplicates: true,
    });
    return missing.length;
  }

  /** Courses with no cover yet (or drawn by an older renderer) get one. */
  async backfill() {
    const rows = await this.prisma.course.findMany({ where: { OR: [{ coverKey: null }, { coverTemplateId: null }, { NOT: { coverHash: { startsWith: `${RENDER_VERSION}:` } } }] }, select: { id: true } });
    for (const r of rows) await this.ensureCover(r.id);
    return rows.length;
  }

  // ---------- templates ----------
  private spec(t: Pick<TemplateRow, 'layout' | 'motif' | 'palette'>) {
    return { layout: t.layout as Layout, motif: t.motif as Motif, palette: t.palette as Palette };
  }

  view(t: TemplateRow & { _count?: { courses: number } }) {
    return {
      id: t.id, key: t.key, name: t.name, layout: t.layout, motif: t.motif, palette: t.palette, topics: t.topics, group: t.group,
      active: t.active, sort: t.sort, builtIn: t.builtIn, courseCount: t._count?.courses,
    };
  }

  activeTemplates() {
    return this.prisma.coverTemplate.findMany({ where: { active: true }, orderBy: [{ sort: 'asc' }, { name: 'asc' }] });
  }

  /** The best active template for a topic: one made for it, else the fallback, else the first active one. */
  async suggestTemplate(categorySlug: string | null | undefined) {
    let active = await this.activeTemplates();
    // First use on an empty database (tests, a fresh stack before start-up finished): install the built-ins.
    if (!active.length && (await this.installBuiltIns())) active = await this.activeTemplates();
    if (!active.length) throw new Error('No active cover templates');
    return (categorySlug && active.find((t) => t.topics.includes(categorySlug))) || active.find((t) => t.key === FALLBACK_TEMPLATE_KEY) || active[0]!;
  }

  // ---------- generation ----------
  /** Make sure a course's cover matches its template, title and topic; renders and stores it when anything changed. */
  async ensureCover(courseId: string, opts: { force?: boolean } = {}) {
    const c = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, coverTemplateId: true, coverKey: true, coverHash: true, category: { select: { slug: true, name: true } }, coverTemplate: true },
    });
    if (!c) return null;
    let t = c.coverTemplate;
    if (!t) {
      t = await this.suggestTemplate(c.category?.slug);
      await this.prisma.course.update({ where: { id: c.id }, data: { coverTemplateId: t.id } });
    }
    const topic = c.category?.name ?? null;
    const hash = `${RENDER_VERSION}:${createHash('sha256').update(JSON.stringify([c.title, topic, t.layout, t.motif, t.palette])).digest('hex').slice(0, 12)}`;
    if (!opts.force && c.coverKey && c.coverHash === hash) return c.coverKey;
    const key = `images/covers/${c.id}-${hash.slice(RENDER_VERSION.length + 1)}.png`;
    await this.storage.put(key, coverPng(this.spec(t), { title: c.title, topic }, COVER_W), 'image/png');
    await this.prisma.course.update({ where: { id: c.id }, data: { coverKey: key, coverHash: hash } });
    return key;
  }

  /** PNG preview of a template with a given title (studio picker and admin page); not stored. */
  async preview(templateId: string, title: string, topic: string | null, width: number) {
    const t = await this.prisma.coverTemplate.findUnique({ where: { id: templateId } });
    if (!t) throw notFound('Template');
    return coverPng(this.spec(t), { title: title.trim() || 'Your course title', topic }, width);
  }

  /** Preview of a template that is not saved yet (admin editor). */
  previewSpec(input: Pick<TemplateInput, 'layout' | 'motif' | 'palette'>, title: string, topic: string | null, width: number) {
    this.checkSpec(input);
    return coverPng({ layout: input.layout, motif: input.motif, palette: input.palette }, { title: title.trim() || 'Your course title', topic }, width);
  }

  // ---------- instructor ----------
  /** Picker data: active templates, the course's current one, and its topic's suggestions first. */
  async pickerFor(userId: string, courseId: string) {
    const c = await this.prisma.course.findFirst({ where: { id: courseId, instructorId: userId }, select: { id: true, title: true, coverTemplateId: true, coverKey: true, category: { select: { slug: true, name: true } } } });
    if (!c) throw notFound('Course');
    const templates = await this.activeTemplates();
    const slug = c.category?.slug;
    return {
      course: { id: c.id, title: c.title, topic: c.category?.name ?? null, coverTemplateId: c.coverTemplateId, coverUrl: this.media.imageUrl(c.coverKey) },
      templates: templates.map((t) => ({ ...this.view(t), suggested: !!slug && t.topics.includes(slug) })),
    };
  }

  /** Change a course's cover. Goes live at once, also on published courses (no review, no republishing). */
  async setTemplate(a: Actor, courseId: string, templateId: string) {
    const c = await this.prisma.course.findFirst({ where: { id: courseId, instructorId: a.user.id }, select: { id: true, coverTemplateId: true } });
    if (!c) throw notFound('Course');
    const t = await this.prisma.coverTemplate.findFirst({ where: { id: templateId, active: true } });
    if (!t) throw badRequest('Pick one of the available cover templates', 'cover_template');
    await this.prisma.course.update({ where: { id: courseId }, data: { coverTemplateId: t.id } });
    const key = await this.ensureCover(courseId);
    await this.audit.log({ actorId: a.user.id, action: 'course.cover_changed', targetType: 'course', targetId: courseId, ip: a.ip, meta: { from: c.coverTemplateId, to: t.id, template: t.key } });
    return { courseId, coverTemplateId: t.id, coverUrl: this.media.imageUrl(key) };
  }

  // ---------- super admin ----------
  private checkSpec(i: Pick<TemplateInput, 'layout' | 'motif' | 'palette'>) {
    if (!LAYOUTS.includes(i.layout)) throw badRequest('Unknown layout', 'cover_layout');
    if (!MOTIFS.includes(i.motif)) throw badRequest('Unknown design', 'cover_motif');
    const p = i.palette;
    if (!p || !Array.isArray(p.bg) || p.bg.length !== 2 || ![...p.bg, p.ink, p.a, p.b].every((x) => typeof x === 'string' && HEX.test(x)) || !['dark', 'light'].includes(p.tone)) {
      throw badRequest('Colours must be six-digit hex values like #4f3fb0', 'cover_palette');
    }
  }

  async adminList() {
    const rows = await this.prisma.coverTemplate.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], include: { _count: { select: { courses: true } } } });
    return { layouts: LAYOUTS, motifs: MOTIFS, items: rows.map((r) => this.view(r)) };
  }

  async create(a: Actor, input: TemplateInput) {
    this.checkSpec(input);
    const max = await this.prisma.coverTemplate.aggregate({ _max: { sort: true } });
    const key = `custom-${input.motif}-${Date.now().toString(36)}`;
    const t = await this.prisma.coverTemplate.create({
      data: { key, name: input.name.trim(), layout: input.layout, motif: input.motif, palette: { ...input.palette }, topics: input.topics, group: groupOf(input.motif), active: input.active ?? true, sort: input.sort ?? (max._max.sort ?? 0) + 10 },
    });
    await this.audit.log({ actorId: a.user.id, action: 'cover_template.created', targetType: 'cover_template', targetId: t.id, ip: a.ip, meta: { key, name: t.name } });
    return this.view(t);
  }

  /** Edit a template; courses using it get regenerated covers. Deactivating moves its courses to their best other template. */
  async update(a: Actor, id: string, input: Partial<TemplateInput>) {
    const t = await this.prisma.coverTemplate.findUnique({ where: { id } });
    if (!t) throw notFound('Template');
    const next = { layout: (input.layout ?? t.layout) as Layout, motif: (input.motif ?? t.motif) as Motif, palette: (input.palette ?? t.palette) as Palette };
    this.checkSpec(next);
    if (input.active === false && t.active && (await this.prisma.coverTemplate.count({ where: { active: true } })) <= 1) throw badRequest('Keep at least one template active', 'cover_last_active');
    const updated = await this.prisma.coverTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        layout: next.layout, motif: next.motif, palette: { ...next.palette }, group: groupOf(next.motif),
        ...(input.topics !== undefined ? { topics: input.topics } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.sort !== undefined ? { sort: input.sort } : {}),
      },
    });
    const courses = await this.prisma.course.findMany({ where: { coverTemplateId: id }, select: { id: true, category: { select: { slug: true } } } });
    let moved = 0;
    if (!updated.active) {
      for (const c of courses) {
        const alt = await this.suggestTemplate(c.category?.slug);
        await this.prisma.course.update({ where: { id: c.id }, data: { coverTemplateId: alt.id } });
        moved++;
      }
    }
    for (const c of courses) await this.ensureCover(c.id);
    await this.audit.log({ actorId: a.user.id, action: 'cover_template.updated', targetType: 'cover_template', targetId: id, ip: a.ip, meta: { changes: input, coursesRegenerated: courses.length, coursesMoved: moved } });
    return { ...this.view(updated), coursesRegenerated: courses.length, coursesMoved: moved };
  }
}
