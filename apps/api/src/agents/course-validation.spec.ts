import type { CourseTree, TreeLecture } from '../instructor/course-tree';
import { validateCourse, type AssetFact } from './course-validation';

const lec = (o: Partial<TreeLecture> & { id: string; title: string }): TreeLecture => ({ type: 'video', isPreview: false, articleMd: null, videoAssetId: null, durationSec: 60, resources: [], quiz: null, ...o });
const tree = (sections: CourseTree['sections'], course: Partial<CourseTree['course']> = {}): CourseTree => ({
  version: 1,
  course: { title: 'Kubernetes basics', subtitle: 'Hands-on', description: 'A course', language: 'en', level: 'beginner', objectives: ['Run pods'], requirements: [], priceCents: 1999, categoryId: 'cat', thumbnailKey: null, promoVideoAssetId: null, ...course },
  sections,
});
const facts = (assets: Record<string, AssetFact>, present: string[] = [], hasCover = true) => ({ asset: (id: string) => assets[id], resourceExists: (k: string) => present.includes(k), hasCover });

describe('validateCourse', () => {
  it('is ready when every video is processed and every file exists', () => {
    const t = tree([{ id: 's1', title: 'Intro', lectures: [lec({ id: 'l1', title: 'Welcome', videoAssetId: 'a1', resources: [{ id: 'r1', title: 'Slides', storageKey: 'k1', sizeBytes: 1, mime: 'application/pdf' }] })] }]);
    const v = validateCourse(t, facts({ a1: { status: 'ready' } }, ['k1']));
    expect(v.ready).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.stats).toMatchObject({ lectures: 1, videosReady: 1, resources: 1, durationSec: 60 });
  });

  it('never reports success for a video still processing, failed, or missing', () => {
    const t = tree([{ id: 's1', title: 'A', lectures: [
      lec({ id: 'l1', title: 'One', videoAssetId: 'a1' }),
      lec({ id: 'l2', title: 'Two', videoAssetId: 'a2' }),
      lec({ id: 'l3', title: 'Three' }),
    ] }]);
    const v = validateCourse(t, facts({ a1: { status: 'processing' }, a2: { status: 'failed', error: 'not a video' } }));
    expect(v.ready).toBe(false);
    expect(v.errors.map((e) => e.code)).toEqual(expect.arrayContaining(['readiness_curriculum', 'video_failed']));
    expect(v.errors.find((e) => e.code === 'video_failed')!.message).toMatch(/not a video/);
    expect(v.stats).toMatchObject({ videosProcessing: 1, videosFailed: 1, videosMissing: 1 });
  });

  it('flags files that were not uploaded, empty quizzes and articles', () => {
    const t = tree([{ id: 's1', title: 'A', lectures: [
      lec({ id: 'l1', title: 'Lab', type: 'article', articleMd: '', resources: [{ id: 'r', title: 'lab.zip', storageKey: 'gone', sizeBytes: 1, mime: 'application/zip' }] }),
      lec({ id: 'l2', title: 'Check', type: 'quiz', quiz: [] }),
    ] }]);
    const codes = validateCourse(t, facts({})).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(['resource_missing', 'quiz_empty', 'article_empty']));
  });

  it('warns about duplicates, empty sections and missing details without blocking', () => {
    const t = tree([
      { id: 's1', title: 'A', lectures: [lec({ id: 'l1', title: 'Same', videoAssetId: 'a1' }), lec({ id: 'l2', title: 'same', videoAssetId: 'a1' }), lec({ id: 'l3', title: 'Other', videoAssetId: 'a2' })] },
      { id: 's2', title: 'Empty', lectures: [] },
    ], { subtitle: '', objectives: [] });
    const v = validateCourse(t, facts({ a1: { status: 'ready', sha256: 'abc' }, a2: { status: 'ready', sha256: 'abc' } }, [], false));
    expect(v.ready).toBe(true);
    expect(v.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['duplicate_title', 'duplicate_video', 'duplicate_upload', 'empty_section', 'subtitle', 'objectives', 'cover']));
  });

  it('needs a description, a category and at least one lesson', () => {
    const v = validateCourse(tree([], { description: '', categoryId: null }), facts({}));
    expect(v.ready).toBe(false);
    expect(v.errors.map((e) => e.code)).toEqual(expect.arrayContaining(['readiness_description', 'readiness_categoryId', 'readiness_curriculum']));
  });
});
