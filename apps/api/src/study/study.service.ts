import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import { type Actor, type AuthUser, isAdmin } from '../common/auth-context';
import { AppError, badRequest, forbidden, notFound, unavailable } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';
import { LearningService } from '../learning/learning.service';
import { aiErrorReason, askModel, learningAiEnabled, usageOf, type LearningAi } from './ai-client';
import { CaptionIndexService } from './caption-index.service';
import { limitDecision, startOfUtcDay } from './limits';
import { buildAskParams, NOT_COVERED_ANSWER, parseAskReply, type HistoryTurn, type OutlineLesson, type SourcePassage } from './prompts';
import { buildPassages, highlightParts, matchingLessons, retrievalTsQuery, searchTsQuery, windowsFor, type RankedHit, type SegmentRow } from './retrieval';
import { LEARNING_AI, StudyNotesService } from './study-notes.service';

const SEARCH_LIMIT = 30;

interface CourseLesson {
  id: string;
  title: string;
  summary: string;
  durationSec: number;
  section: string;
  videoAssetId: string | null;
  hasCaptions: boolean;
}

/** Search inside videos, the course assistant and the study notes for people with access to a course (docs/AI_LEARNING.md). */
@Injectable()
export class StudyService {
  private readonly log = new Logger('Study');
  constructor(
    private readonly prisma: PrismaService,
    private readonly learning: LearningService,
    private readonly index: CaptionIndexService,
    private readonly notes: StudyNotesService,
    private readonly audit: AuditService,
    @Inject(LEARNING_AI) private readonly ai: LearningAi,
  ) {}

  /** Course + lessons in course order, after the same access rule as the player (enrolled with active access, owner, admin). */
  private async courseFor(user: AuthUser, slug: string) {
    const c = await this.prisma.course.findUnique({
      where: { slug },
      select: {
        id: true, title: true, instructorId: true,
        sections: { orderBy: { position: 'asc' }, select: { title: true, lectures: { orderBy: { position: 'asc' }, select: { id: true, title: true, summary: true, durationSec: true, videoAssetId: true, videoAsset: { select: { captionsKey: true } } } } } },
      },
    });
    if (!c) throw notFound('Course');
    if (!(await this.learning.access(user, c))) throw forbidden('Enrol in this course to search it', 'not_enrolled');
    const lessons: CourseLesson[] = c.sections.flatMap((s) => s.lectures.map((l) => ({ id: l.id, title: l.title, summary: l.summary, durationSec: l.durationSec, section: s.title, videoAssetId: l.videoAssetId, hasCaptions: !!l.videoAsset?.captionsKey })));
    return { id: c.id, title: c.title, lessons };
  }

  /** The first lesson of the course that plays each video (a video can be reused). */
  private lessonByAsset(lessons: CourseLesson[]) {
    const m = new Map<string, CourseLesson>();
    for (const l of lessons) if (l.videoAssetId && !m.has(l.videoAssetId)) m.set(l.videoAssetId, l);
    return m;
  }

  private async captionedAssets(lessons: CourseLesson[]) {
    const ids = [...new Set(lessons.filter((l) => l.hasCaptions && l.videoAssetId).map((l) => l.videoAssetId!))];
    await this.index.ensureIndexed(ids);
    return ids;
  }

  // ------------------------------------------------------------------ search inside videos (no AI)

  async search(user: AuthUser, slug: string, q: string) {
    const course = await this.courseFor(user, slug);
    const query = q.trim().slice(0, 200);
    if (query.length < 2) return { query, items: [] };
    const assetIds = await this.captionedAssets(course.lessons);
    if (!assetIds.length) return { query, items: [] };
    const tsq = searchTsQuery(query);
    type Row = { videoAssetId: string; seq: number; startSec: number; endSec: number; text: string };
    let rows: Row[] = [];
    if (tsq) {
      rows = await this.prisma.$queryRaw<Row[]>`
        SELECT s."videoAssetId", s."seq", s."startSec", s."endSec", s."text"
        FROM "caption_segments" s, to_tsquery('english', ${tsq}) q
        WHERE s."videoAssetId" = ANY(${assetIds}::text[]) AND s."tsv" @@ q
        ORDER BY ts_rank_cd(s."tsv", q) DESC, s."startSec" ASC
        LIMIT ${SEARCH_LIMIT}`;
    }
    // Words full-text search drops (stop words like "it", odd tokens): fall back to a plain substring match.
    if (!rows.length && query.length >= 3) {
      const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      rows = await this.prisma.$queryRaw<Row[]>`
        SELECT s."videoAssetId", s."seq", s."startSec", s."endSec", s."text"
        FROM "caption_segments" s
        WHERE s."videoAssetId" = ANY(${assetIds}::text[]) AND s."text" ILIKE ${like}
        ORDER BY s."videoAssetId", s."seq" LIMIT ${SEARCH_LIMIT}`;
    }
    const byAsset = this.lessonByAsset(course.lessons);
    return {
      query,
      items: rows.flatMap((r) => {
        const l = byAsset.get(r.videoAssetId);
        return l ? [{ lectureId: l.id, lectureTitle: l.title, sectionTitle: l.section, startSec: Math.floor(Number(r.startSec)), endSec: Math.ceil(Number(r.endSec)), parts: highlightParts(r.text, query) }] : [];
      }),
    };
  }

  // ------------------------------------------------------------------ course assistant (AI)

  private assertAi() {
    // Hidden, not "coming soon": without a key the endpoints don't exist for the browser (AGENTS rule 4).
    if (!learningAiEnabled()) throw notFound('Page');
  }

  async ask(user: AuthUser, slug: string, input: { question: string; lectureId?: string; history?: HistoryTurn[] }) {
    this.assertAi();
    const course = await this.courseFor(user, slug);
    const question = input.question.trim();
    if (question.length < 3) throw badRequest('Ask a question of at least a few words', 'question_too_short');

    // Rate limit: the request is recorded first, then counted, so parallel requests can't slip past the cap.
    const usage = await this.prisma.aiUsage.create({ data: { userId: user.id, kind: 'ask', courseId: course.id, lectureId: input.lectureId ?? null, status: 'pending' } });
    const now = new Date();
    const counted = { kind: 'ask', status: { not: 'limited' } };
    const [lastMinute, today, platformToday] = await Promise.all([
      this.prisma.aiUsage.count({ where: { ...counted, userId: user.id, createdAt: { gte: new Date(now.getTime() - 60_000) } } }),
      this.prisma.aiUsage.count({ where: { ...counted, userId: user.id, createdAt: { gte: startOfUtcDay(now) } } }),
      this.prisma.aiUsage.count({ where: { ...counted, createdAt: { gte: startOfUtcDay(now) } } }),
    ]);
    const e = env();
    const decision = limitDecision({ lastMinute, today, platformToday }, { perMinute: e.LEARNING_AI_PER_MINUTE, perDay: e.LEARNING_AI_PER_DAY, platformPerDay: e.LEARNING_AI_PLATFORM_PER_DAY }, now);
    if (!decision.ok) {
      await this.prisma.aiUsage.update({ where: { id: usage.id }, data: { status: 'limited' } });
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited', decision.message, { retryAfterSec: decision.retryAfterSec, reason: decision.reason });
    }

    const { lessons, passages } = await this.retrieve(course, question, input.lectureId);
    const finish = (data: Prisma.AiUsageUpdateInput) => this.prisma.aiUsage.update({ where: { id: usage.id }, data: { passages: passages.length, ...data } });

    // Nothing in the transcripts and no lesson title or summary shares a word with the question: answer honestly
    // without calling the model (cheaper, and it can't make something up).
    if (!passages.length && !matchingLessons(course.lessons, question).length) {
      await finish({ status: 'not_covered' });
      return { covered: false, answer: NOT_COVERED_ANSWER, citations: [], remainingToday: decision.remainingToday };
    }

    const model = askModel();
    try {
      const m = await this.ai.complete(buildAskParams({ model, courseTitle: course.title, lessons, passages, question, history: input.history }));
      if (m.stop_reason === 'refusal') {
        await finish({ ...usageOf(m), model: m.model, status: 'refused' });
        return { covered: false, answer: 'I can’t help with that question here. For anything outside this course, see the Help page or contact DEL support.', citations: [], remainingToday: decision.remainingToday };
      }
      const reply = parseAskReply(m, passages, lessons);
      if (!reply) {
        await finish({ ...usageOf(m), model: m.model, status: 'error' });
        throw unavailable('The course assistant couldn’t answer just now. Please try again.', 'assistant_unavailable');
      }
      await finish({ ...usageOf(m), model: m.model, status: reply.covered ? 'ok' : 'not_covered' });
      return { ...reply, remainingToday: decision.remainingToday };
    } catch (err) {
      if (err instanceof AppError) throw err;
      await finish({ status: 'error' }).catch(() => undefined);
      this.log.warn(`course assistant failed: ${aiErrorReason(err)}`);
      throw unavailable('The course assistant couldn’t answer just now. Please try again.', 'assistant_unavailable');
    }
  }

  /** The most relevant transcript passages of this course (lexical ranking; the current lesson counts a bit more). */
  async retrieve(course: { lessons: CourseLesson[] }, question: string, currentLectureId?: string) {
    const lessons: OutlineLesson[] = course.lessons.map((l, i) => ({ ref: `L${i + 1}`, lectureId: l.id, title: l.title, section: l.section, summary: l.summary, durationSec: l.durationSec }));
    const assetIds = await this.captionedAssets(course.lessons);
    const tsq = retrievalTsQuery(question);
    if (!assetIds.length || !tsq) return { lessons, passages: [] as SourcePassage[] };
    const hits = (
      await this.prisma.$queryRaw<RankedHit[]>`
        SELECT s."videoAssetId", s."seq", ts_rank_cd(s."tsv", q, 1) AS rank
        FROM "caption_segments" s, to_tsquery('english', ${tsq}) q
        WHERE s."videoAssetId" = ANY(${assetIds}::text[]) AND s."tsv" @@ q
        ORDER BY rank DESC LIMIT 24`
    ).map((h) => ({ ...h, rank: Number(h.rank) }));
    const currentAsset = course.lessons.find((l) => l.id === currentLectureId)?.videoAssetId;
    for (const h of hits) if (h.videoAssetId === currentAsset) h.rank *= 1.5;
    const want = windowsFor(hits, { top: 8, around: 1 });
    if (!want.length) return { lessons, passages: [] as SourcePassage[] };
    const rows: SegmentRow[] = await this.prisma.captionSegment.findMany({ where: { OR: want.map((w) => ({ videoAssetId: w.videoAssetId, seq: w.seq })) }, select: { videoAssetId: true, seq: true, startSec: true, endSec: true, text: true } });
    const byAsset = this.lessonByAsset(course.lessons);
    const refOf = new Map(lessons.map((l) => [l.lectureId, l.ref]));
    const passages: SourcePassage[] = buildPassages(hits, rows).flatMap((p, i) => {
      const l = byAsset.get(p.videoAssetId);
      return l ? [{ ref: `S${i + 1}`, lectureId: l.id, lessonRef: refOf.get(l.id) ?? '', lessonTitle: l.title, startSec: p.startSec, endSec: p.endSec, text: p.text }] : [];
    });
    return { lessons, passages };
  }

  // ------------------------------------------------------------------ study notes (AI)

  async lessonNotes(user: AuthUser, lectureId: string) {
    this.assertAi();
    const l = await this.lectureWithCourse(lectureId);
    if (!(await this.learning.access(user, l.section.course))) throw forbidden('Enrol in this course to open this lesson', 'not_enrolled');
    if (!l.videoAssetId || !l.videoAsset?.captionsKey) return { status: 'unavailable' as const };
    await this.index.ensureIndexed([l.videoAssetId]);
    return this.notes.viewFor(l.videoAssetId);
  }

  /** Studio: the course owner (or an admin) sees and regenerates a lesson's notes. */
  async instructorNotes(a: Actor, lectureId: string, regenerate = false) {
    this.assertAi();
    const l = await this.lectureWithCourse(lectureId);
    if (l.section.course.instructorId !== a.user.id && !isAdmin(a.user)) throw notFound('Lecture');
    if (!l.videoAssetId || !l.videoAsset?.captionsKey) return { status: 'unavailable' as const };
    await this.index.ensureIndexed([l.videoAssetId]);
    if (!regenerate) return this.notes.viewFor(l.videoAssetId);
    await this.audit.log({ actorId: a.user.id, action: 'study_notes.regenerate', targetType: 'lecture', targetId: lectureId, ip: a.ip });
    return this.notes.regenerate(l.videoAssetId);
  }

  private async lectureWithCourse(lectureId: string) {
    const l = await this.prisma.lecture.findUnique({
      where: { id: lectureId },
      select: { id: true, videoAssetId: true, videoAsset: { select: { captionsKey: true } }, section: { select: { course: { select: { id: true, instructorId: true } } } } },
    });
    if (!l) throw notFound('Lecture');
    return l;
  }
}
