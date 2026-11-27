import { randomUUID } from 'node:crypto';
import type { CourseLevel, LectureType } from '../generated/prisma/enums';
import { badRequest, notFound } from '../common/errors';
import { usd } from '../common/pricing';

/**
 * The editable tree of a course (details, media, price, curriculum, resources, quizzes) as plain JSON.
 * A CourseRevision stores one of these as its snapshot; approving a revision applies it to the live tables
 * (see RevisionsService.applyTree). Existing sections/lectures/resources keep their ids, so learners keep
 * their progress; new items get fresh UUIDs here and are created with those ids on approval.
 *
 * Everything in this file is pure (no database), so it is easy to test.
 */
export interface TreeCourse {
  title: string;
  subtitle: string;
  description: string;
  language: string;
  level: CourseLevel;
  objectives: string[];
  requirements: string[];
  priceCents: number;
  categoryId: string | null;
  thumbnailKey: string | null;
  promoVideoAssetId: string | null;
  /** DEL courses only: the instructor name shown ("Taught by"). */
  taughtBy?: string | null;
}
export interface TreeResource {
  id: string;
  title: string;
  storageKey: string;
  sizeBytes: number;
  mime: string;
}
export interface TreeQuestion {
  q: string;
  options: string[];
  correct: number;
  why: string;
}
export interface TreeLecture {
  id: string;
  title: string;
  type: LectureType;
  isPreview: boolean;
  articleMd: string | null;
  /** optional for snapshots written before the field existed */
  summary?: string;
  videoAssetId: string | null;
  durationSec: number;
  resources: TreeResource[];
  quiz: TreeQuestion[] | null;
}
export interface TreeSection {
  id: string;
  title: string;
  lectures: TreeLecture[];
}
export interface CourseTree {
  version: 1;
  course: TreeCourse;
  sections: TreeSection[];
}

export const COURSE_FIELDS = [
  'title',
  'subtitle',
  'description',
  'language',
  'level',
  'objectives',
  'requirements',
  'priceCents',
  'categoryId',
  'thumbnailKey',
  'promoVideoAssetId',
  'taughtBy',
] as const satisfies readonly (keyof TreeCourse)[];

/** Shape of a course row loaded with sections → lectures → resources + quiz (ordered by position). */
export interface CourseRowWithTree extends TreeCourse {
  sections: {
    id: string;
    title: string;
    lectures: {
      id: string;
      title: string;
      type: LectureType;
      isPreview: boolean;
      articleMd: string | null;
      summary: string;
      videoAssetId: string | null;
      durationSec: number;
      resources: TreeResource[];
      quiz: { questions: unknown } | null;
    }[];
  }[];
}

export function treeFromRow(c: CourseRowWithTree): CourseTree {
  const course = Object.fromEntries(COURSE_FIELDS.map((k) => [k, c[k]])) as unknown as TreeCourse;
  return {
    version: 1,
    course: { ...course, objectives: [...course.objectives], requirements: [...course.requirements] },
    sections: c.sections.map((s) => ({
      id: s.id,
      title: s.title,
      lectures: s.lectures.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        isPreview: l.isPreview,
        articleMd: l.articleMd,
        summary: l.summary,
        videoAssetId: l.videoAssetId,
        durationSec: l.durationSec,
        resources: l.resources.map((r) => ({ id: r.id, title: r.title, storageKey: r.storageKey, sizeBytes: r.sizeBytes, mime: r.mime })),
        quiz: l.quiz ? (l.quiz.questions as TreeQuestion[]) : null,
      })),
    })),
  };
}

export const cloneTree = (t: CourseTree): CourseTree => JSON.parse(JSON.stringify(t)) as CourseTree;

export function allLectures(t: CourseTree) {
  return t.sections.flatMap((s) => s.lectures.map((l) => ({ section: s, lecture: l })));
}

export function findSection(t: CourseTree, sectionId: string) {
  const s = t.sections.find((x) => x.id === sectionId);
  if (!s) throw notFound('Section');
  return s;
}

export function findLecture(t: CourseTree, lectureId: string) {
  for (const s of t.sections) {
    const i = s.lectures.findIndex((l) => l.id === lectureId);
    if (i >= 0) return { section: s, lecture: s.lectures[i], index: i };
  }
  throw notFound('Lecture');
}

function assertSameSet(existing: string[], given: string[]) {
  const a = new Set(existing);
  if (given.length !== existing.length || new Set(given).size !== given.length || !given.every((g) => a.has(g))) {
    throw badRequest('ids must list every item exactly once', 'invalid_order');
  }
}

// ---------- mutations (all in place on a draft tree) ----------

export function updateCourseFields(t: CourseTree, input: Partial<TreeCourse>) {
  for (const k of COURSE_FIELDS) {
    if (input[k] !== undefined) (t.course as any)[k] = input[k];
  }
}

export function addSection(t: CourseTree, title: string) {
  const s: TreeSection = { id: randomUUID(), title, lectures: [] };
  t.sections.push(s);
  return s;
}

export function renameSection(t: CourseTree, sectionId: string, title: string) {
  const s = findSection(t, sectionId);
  s.title = title;
  return s;
}

export function deleteSection(t: CourseTree, sectionId: string) {
  findSection(t, sectionId);
  t.sections = t.sections.filter((s) => s.id !== sectionId);
}

export function reorderSections(t: CourseTree, ids: string[]) {
  assertSameSet(t.sections.map((s) => s.id), ids);
  const byId = new Map(t.sections.map((s) => [s.id, s]));
  t.sections = ids.map((id) => byId.get(id)!);
}

export interface TreeLectureInput {
  title?: string;
  type?: LectureType;
  isPreview?: boolean;
  articleMd?: string | null;
  summary?: string;
  /** already ownership-checked by the caller; durationSec comes from the asset */
  video?: { videoAssetId: string | null; durationSec: number };
  sectionId?: string;
}

export function addLecture(t: CourseTree, sectionId: string, input: TreeLectureInput & { title: string }) {
  const s = findSection(t, sectionId);
  const type = input.type ?? 'video';
  const l: TreeLecture = {
    id: randomUUID(),
    title: input.title,
    type,
    isPreview: input.isPreview ?? false,
    articleMd: input.articleMd ?? null,
    summary: input.summary ?? '',
    videoAssetId: input.video?.videoAssetId ?? null,
    durationSec: input.video?.durationSec ?? 0,
    resources: [],
    quiz: null,
  };
  s.lectures.push(l);
  return l;
}

export function updateLecture(t: CourseTree, lectureId: string, input: TreeLectureInput) {
  const found = findLecture(t, lectureId);
  const l = found.lecture;
  if (input.title !== undefined) l.title = input.title;
  if (input.type !== undefined) l.type = input.type;
  if (input.isPreview !== undefined) l.isPreview = input.isPreview;
  if (input.articleMd !== undefined) l.articleMd = input.articleMd;
  if (input.summary !== undefined) l.summary = input.summary;
  if (input.video) {
    l.videoAssetId = input.video.videoAssetId;
    l.durationSec = input.video.durationSec;
  }
  if (input.sectionId && input.sectionId !== found.section.id) {
    const target = findSection(t, input.sectionId);
    found.section.lectures.splice(found.index, 1);
    target.lectures.push(l);
  }
  return l;
}

export function deleteLecture(t: CourseTree, lectureId: string) {
  const { section, index } = findLecture(t, lectureId);
  section.lectures.splice(index, 1);
}

export function reorderLectures(t: CourseTree, sectionId: string, ids: string[]) {
  const s = findSection(t, sectionId);
  assertSameSet(s.lectures.map((l) => l.id), ids);
  const byId = new Map(s.lectures.map((l) => [l.id, l]));
  s.lectures = ids.map((id) => byId.get(id)!);
}

/**
 * Drag-and-drop result in one step: the order of sections and, for each, its lessons. Lessons may change section;
 * every section and lesson must appear exactly once (nothing is created or lost here).
 */
export function arrange(t: CourseTree, layout: { id: string; lectureIds: string[] }[]) {
  assertSameSet(t.sections.map((s) => s.id), layout.map((x) => x.id));
  const all = new Map(t.sections.flatMap((s) => s.lectures.map((l) => [l.id, l] as const)));
  assertSameSet([...all.keys()], layout.flatMap((x) => x.lectureIds));
  const byId = new Map(t.sections.map((s) => [s.id, s]));
  t.sections = layout.map((x) => ({ ...byId.get(x.id)!, lectures: x.lectureIds.map((id) => all.get(id)!) }));
}

export function setQuiz(t: CourseTree, lectureId: string, questions: TreeQuestion[] | null) {
  findLecture(t, lectureId).lecture.quiz = questions;
}

export function addResource(t: CourseTree, lectureId: string, r: Omit<TreeResource, 'id'>) {
  const res: TreeResource = { id: randomUUID(), ...r };
  findLecture(t, lectureId).lecture.resources.push(res);
  return res;
}

export function deleteResource(t: CourseTree, resourceId: string) {
  for (const { lecture } of allLectures(t)) {
    const i = lecture.resources.findIndex((r) => r.id === resourceId);
    if (i >= 0) {
      lecture.resources.splice(i, 1);
      return;
    }
  }
  throw notFound('Resource');
}

// ---------- readiness ----------

export interface Problem {
  field: string;
  message: string;
}

/** What must be true before a course (or a revision of one) can be submitted for review. */
export function readinessProblems(t: CourseTree, videoStatus: (assetId: string) => string | undefined): Problem[] {
  const problems: Problem[] = [];
  const lectures = allLectures(t).map((x) => x.lecture);
  if (!t.course.description.trim()) problems.push({ field: 'description', message: 'Add a description' });
  if (!t.course.categoryId) problems.push({ field: 'categoryId', message: 'Choose a category' });
  if (!lectures.length) problems.push({ field: 'curriculum', message: 'Add at least one lecture' });
  const notReady = lectures.filter((l) => l.type === 'video' && (!l.videoAssetId || videoStatus(l.videoAssetId) !== 'ready'));
  if (notReady.length) {
    problems.push({ field: 'curriculum', message: `Every video lecture needs a processed video (${notReady.map((l) => `“${l.title}”`).join(', ')})` });
  }
  if (t.course.promoVideoAssetId && videoStatus(t.course.promoVideoAssetId) !== 'ready') {
    problems.push({ field: 'promoVideoAssetId', message: 'The promo video is still processing' });
  }
  return problems;
}

// ---------- diff ----------

export interface Change {
  area: 'details' | 'pricing' | 'media' | 'curriculum';
  kind: 'added' | 'removed' | 'changed' | 'reordered';
  message: string;
}

const LABEL: Record<(typeof COURSE_FIELDS)[number], string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  description: 'Description',
  language: 'Language',
  level: 'Level',
  objectives: 'What learners will learn',
  requirements: 'Requirements',
  priceCents: 'Price',
  categoryId: 'Category',
  thumbnailKey: 'Thumbnail',
  promoVideoAssetId: 'Promo video',
  taughtBy: 'Instructor name shown',
};
const q = (s: string) => `“${s}”`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Plain-English summary of what a draft changes compared with the live course. */
export function diffTrees(live: CourseTree, draft: CourseTree, categoryName: (id: string | null) => string = (id) => id ?? 'none'): Change[] {
  const out: Change[] = [];
  for (const k of COURSE_FIELDS) {
    const a = live.course[k] ?? null;
    const b = draft.course[k] ?? null;
    if (same(a, b)) continue;
    if (k === 'priceCents') {
      const fmt = (c: number) => (c === 0 ? 'free' : usd(c));
      out.push({ area: 'pricing', kind: 'changed', message: `Price: ${fmt(a as number)} → ${fmt(b as number)}` });
    } else if (k === 'thumbnailKey' || k === 'promoVideoAssetId') {
      const kind = !a ? 'added' : !b ? 'removed' : 'changed';
      out.push({ area: 'media', kind, message: `${LABEL[k]} ${kind === 'changed' ? 'replaced' : kind}` });
    } else if (k === 'title') {
      out.push({ area: 'details', kind: 'changed', message: `Title: ${q(a as string)} → ${q(b as string)}` });
    } else if (k === 'level' || k === 'language') {
      out.push({ area: 'details', kind: 'changed', message: `${LABEL[k]}: ${a} → ${b}` });
    } else if (k === 'categoryId') {
      out.push({ area: 'details', kind: 'changed', message: `Category: ${categoryName(a as string | null)} → ${categoryName(b as string | null)}` });
    } else {
      out.push({ area: 'details', kind: 'changed', message: `${LABEL[k]} updated` });
    }
  }

  const liveSections = new Map(live.sections.map((s) => [s.id, s]));
  const draftSections = new Map(draft.sections.map((s) => [s.id, s]));
  for (const s of draft.sections) {
    const old = liveSections.get(s.id);
    if (!old) out.push({ area: 'curriculum', kind: 'added', message: `Section added: ${q(s.title)}` });
    else if (old.title !== s.title) out.push({ area: 'curriculum', kind: 'changed', message: `Section renamed: ${q(old.title)} → ${q(s.title)}` });
  }
  for (const s of live.sections) if (!draftSections.has(s.id)) out.push({ area: 'curriculum', kind: 'removed', message: `Section removed: ${q(s.title)}` });
  const keptOrder = (ids: string[], keep: Set<string>) => ids.filter((id) => keep.has(id));
  const bothSections = new Set(live.sections.filter((s) => draftSections.has(s.id)).map((s) => s.id));
  if (!same(keptOrder(live.sections.map((s) => s.id), bothSections), keptOrder(draft.sections.map((s) => s.id), bothSections))) {
    out.push({ area: 'curriculum', kind: 'reordered', message: 'Sections reordered' });
  }

  const liveLectures = new Map(allLectures(live).map((x) => [x.lecture.id, x]));
  const draftLectures = new Map(allLectures(draft).map((x) => [x.lecture.id, x]));
  for (const { section, lecture: l } of allLectures(draft)) {
    const old = liveLectures.get(l.id);
    if (!old) {
      out.push({ area: 'curriculum', kind: 'added', message: `Lecture added: ${q(l.title)} (in ${q(section.title)})` });
      continue;
    }
    const o = old.lecture;
    const name = q(l.title);
    if (o.title !== l.title) out.push({ area: 'curriculum', kind: 'changed', message: `Lecture renamed: ${q(o.title)} → ${name}` });
    if (old.section.id !== section.id) out.push({ area: 'curriculum', kind: 'changed', message: `Lecture moved: ${name} → ${q(section.title)}` });
    if (o.type !== l.type) out.push({ area: 'curriculum', kind: 'changed', message: `Lecture type: ${name} is now ${l.type}` });
    if (o.videoAssetId !== l.videoAssetId) {
      out.push({ area: 'curriculum', kind: 'changed', message: l.videoAssetId ? (o.videoAssetId ? `Video replaced: ${name}` : `Video added: ${name}`) : `Video removed: ${name}` });
    }
    if (o.isPreview !== l.isPreview) out.push({ area: 'curriculum', kind: 'changed', message: `Free preview ${l.isPreview ? 'on' : 'off'}: ${name}` });
    if ((o.summary ?? '') !== (l.summary ?? '')) out.push({ area: 'curriculum', kind: 'changed', message: `Summary edited: ${name}` });
    if ((o.articleMd ?? '') !== (l.articleMd ?? '')) out.push({ area: 'curriculum', kind: 'changed', message: `Article text edited: ${name}` });
    if (!same(o.quiz, l.quiz)) {
      out.push({ area: 'curriculum', kind: !o.quiz ? 'added' : !l.quiz ? 'removed' : 'changed', message: `Quiz ${!o.quiz ? 'added' : !l.quiz ? 'removed' : 'changed'}: ${name}` });
    }
    const oldRes = new Map(o.resources.map((r) => [r.id, r]));
    const newRes = new Set(l.resources.map((r) => r.id));
    for (const r of l.resources) if (!oldRes.has(r.id)) out.push({ area: 'curriculum', kind: 'added', message: `File added: ${q(r.title)} (${name})` });
    for (const r of o.resources) if (!newRes.has(r.id)) out.push({ area: 'curriculum', kind: 'removed', message: `File removed: ${q(r.title)} (${name})` });
  }
  for (const { lecture } of allLectures(live)) {
    if (!draftLectures.has(lecture.id)) out.push({ area: 'curriculum', kind: 'removed', message: `Lecture removed: ${q(lecture.title)}` });
  }
  // Lecture order inside sections that exist on both sides (ignoring added/removed/moved lectures).
  for (const s of draft.sections) {
    const old = liveSections.get(s.id);
    if (!old) continue;
    const both = new Set(old.lectures.map((l) => l.id).filter((id) => s.lectures.some((l) => l.id === id)));
    if (!same(keptOrder(old.lectures.map((l) => l.id), both), keptOrder(s.lectures.map((l) => l.id), both))) {
      out.push({ area: 'curriculum', kind: 'reordered', message: `Lectures reordered in ${q(s.title)}` });
    }
  }
  return out;
}
