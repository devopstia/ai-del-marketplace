import { Inject, Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { aiErrorReason, learningAiEnabled, notesModel, usageOf, type LearningAi } from './ai-client';
import { buildNotesParams, parseNotes, type StudyNotesContent } from './prompts';
import { transcriptWithTimes } from './vtt';

export const LEARNING_AI = Symbol('LEARNING_AI');
export const NOTES_MAX_ATTEMPTS = 3;
/** A job that hasn't finished after this long is considered lost (worker restart) and queued again. */
const STUCK_MS = 10 * 60_000;

export type NotesView =
  | { status: 'ready'; summary: string; keyPoints: string[]; questions: StudyNotesContent['questions']; generatedAt: Date | null; model: string | null }
  | { status: 'generating' | 'unavailable' | 'failed' };

/**
 * AI study notes (docs/AI_LEARNING.md): one set per lesson video and caption version, generated in the worker the
 * first time someone opens them and shared by every learner. New captions = new content hash = notes regenerated.
 */
@Injectable()
export class StudyNotesService {
  private readonly log = new Logger('StudyNotes');
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    @Inject(LEARNING_AI) private readonly ai: LearningAi,
  ) {}

  /** What a learner sees; queues generation when the notes are missing or out of date. */
  async viewFor(videoAssetId: string): Promise<NotesView> {
    const idx = await this.prisma.captionIndex.findUnique({ where: { videoAssetId } });
    if (!idx || idx.status !== 'ready') return { status: 'unavailable' };
    const n = await this.prisma.studyNotes.findUnique({ where: { videoAssetId } });
    if (n && n.contentHash === idx.contentHash) {
      if (n.status === 'ready') return { status: 'ready', summary: n.summary, keyPoints: n.keyPoints as string[], questions: n.questions as StudyNotesContent['questions'], generatedAt: n.generatedAt, model: n.model };
      if (n.status === 'empty') return { status: 'unavailable' };
      if (n.status === 'failed' && n.attempts >= NOTES_MAX_ATTEMPTS) return { status: 'failed' };
      if ((n.status === 'queued' || n.status === 'generating') && Date.now() - n.updatedAt.getTime() < STUCK_MS) return { status: 'generating' };
    }
    await this.queue(videoAssetId, idx.contentHash, n?.contentHash !== idx.contentHash);
    return { status: 'generating' };
  }

  /** Instructor "Regenerate": a fresh attempt for the current captions. */
  async regenerate(videoAssetId: string): Promise<NotesView> {
    const idx = await this.prisma.captionIndex.findUnique({ where: { videoAssetId } });
    if (!idx || idx.status !== 'ready') return { status: 'unavailable' };
    await this.queue(videoAssetId, idx.contentHash, true);
    return { status: 'generating' };
  }

  private async queue(videoAssetId: string, contentHash: string, reset: boolean) {
    await this.prisma.studyNotes.upsert({
      where: { videoAssetId },
      create: { videoAssetId, contentHash, status: 'queued' },
      update: { contentHash, status: 'queued', ...(reset ? { attempts: 0, error: null } : {}) },
    });
    await this.jobs.studyNotes(videoAssetId);
  }

  /** Worker: generate the notes of one video from its indexed transcript. Throws to let the queue retry. */
  async generate(videoAssetId: string): Promise<{ status: string }> {
    if (!learningAiEnabled()) return { status: 'disabled' };
    const [idx, notes] = await Promise.all([
      this.prisma.captionIndex.findUnique({ where: { videoAssetId } }),
      this.prisma.studyNotes.findUnique({ where: { videoAssetId } }),
    ]);
    if (!idx || idx.status !== 'ready' || !notes) return { status: 'skipped' };
    if (notes.status === 'ready' && notes.contentHash === idx.contentHash) return { status: 'ready' };
    if (notes.attempts >= NOTES_MAX_ATTEMPTS && notes.status === 'failed') return { status: 'failed' };
    const lecture = await this.prisma.lecture.findFirst({ where: { videoAssetId }, select: { id: true, title: true, durationSec: true, section: { select: { courseId: true } } }, orderBy: { position: 'asc' } });
    const segments = await this.prisma.captionSegment.findMany({ where: { videoAssetId }, orderBy: { seq: 'asc' }, select: { startSec: true, text: true } });
    const { text, truncated } = transcriptWithTimes(segments.map((s) => ({ start: s.startSec, text: s.text })));
    if (text.split(/\s+/).length < 40) {
      await this.prisma.studyNotes.update({ where: { videoAssetId }, data: { status: 'empty', contentHash: idx.contentHash } });
      return { status: 'empty' };
    }
    await this.prisma.studyNotes.update({ where: { videoAssetId }, data: { status: 'generating', attempts: { increment: 1 }, contentHash: idx.contentHash } });
    const model = notesModel();
    const usage = await this.prisma.aiUsage.create({ data: { kind: 'notes', lectureId: lecture?.id ?? null, courseId: lecture?.section.courseId ?? null, model, status: 'pending' } });
    try {
      const m = await this.ai.complete(buildNotesParams({ model, lessonTitle: lecture?.title ?? 'Lesson', transcript: text, truncated }));
      await this.prisma.aiUsage.update({ where: { id: usage.id }, data: { ...usageOf(m), model: m.model, status: m.stop_reason === 'refusal' ? 'refused' : 'ok' } });
      const parsed = m.stop_reason === 'refusal' ? null : parseNotes(m, lecture?.durationSec ?? 0);
      if (!parsed) throw new Error(m.stop_reason === 'refusal' ? 'the model declined' : 'unreadable reply');
      await this.prisma.studyNotes.update({
        where: { videoAssetId },
        data: { status: 'ready', summary: parsed.summary, keyPoints: parsed.keyPoints, questions: parsed.questions, model: m.model, error: null, generatedAt: new Date() },
      });
      return { status: 'ready' };
    } catch (e) {
      const reason = aiErrorReason(e);
      await this.prisma.aiUsage.update({ where: { id: usage.id }, data: { status: 'error' } }).catch(() => undefined);
      const fresh = await this.prisma.studyNotes.findUnique({ where: { videoAssetId }, select: { attempts: true } });
      const last = (fresh?.attempts ?? NOTES_MAX_ATTEMPTS) >= NOTES_MAX_ATTEMPTS;
      await this.prisma.studyNotes.update({ where: { videoAssetId }, data: { status: last ? 'failed' : 'queued', error: reason } });
      this.log.warn(`study notes for video ${videoAssetId} failed: ${reason}`);
      if (last) return { status: 'failed' };
      throw new Error(reason);
    }
  }
}
