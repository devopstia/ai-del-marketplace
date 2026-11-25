import * as T from './course-tree';

function live(): T.CourseTree {
  return {
    version: 1,
    course: {
      title: 'Live title',
      subtitle: '',
      description: 'A real description',
      language: 'en',
      level: 'beginner',
      objectives: ['One'],
      requirements: [],
      priceCents: 4999,
      categoryId: 'cat-1',
      thumbnailKey: 'images/u1/a.png',
      promoVideoAssetId: null,
    },
    sections: [
      {
        id: 's1',
        title: 'Intro',
        lectures: [
          { id: 'l1', title: 'Welcome', type: 'video', isPreview: true, articleMd: null, videoAssetId: 'v1', durationSec: 30, resources: [], quiz: null },
          { id: 'l2', title: 'Lab', type: 'video', isPreview: false, articleMd: null, videoAssetId: 'v2', durationSec: 60, resources: [{ id: 'r1', title: 'Lab ZIP', storageKey: 'resources/u1/x/lab.zip', sizeBytes: 10, mime: 'application/zip' }], quiz: null },
        ],
      },
      { id: 's2', title: 'More', lectures: [{ id: 'l3', title: 'Reading', type: 'article', isPreview: false, articleMd: '# hi', videoAssetId: null, durationSec: 120, resources: [], quiz: null }] },
    ],
  };
}

describe('course tree (revision snapshots)', () => {
  it('an unchanged copy has no changes', () => {
    expect(T.diffTrees(live(), T.cloneTree(live()))).toEqual([]);
  });

  it('mutations on a draft never touch the live tree object', () => {
    const l = live();
    const d = T.cloneTree(l);
    T.updateCourseFields(d, { title: 'New title', priceCents: 5999 });
    T.addSection(d, 'Bonus');
    T.deleteLecture(d, 'l3');
    expect(l).toEqual(live());
  });

  it('describes every kind of change in plain English', () => {
    const d = T.cloneTree(live());
    T.updateCourseFields(d, { title: 'New title', priceCents: 0, thumbnailKey: 'images/u1/b.png', description: 'Changed' });
    const sec = T.addSection(d, 'Bonus');
    T.addLecture(d, sec.id, { title: 'Extra', video: { videoAssetId: 'v9', durationSec: 5 } });
    T.renameSection(d, 's1', 'Start here');
    T.updateLecture(d, 'l1', { isPreview: false, video: { videoAssetId: 'v7', durationSec: 40 } });
    T.setQuiz(d, 'l2', [{ q: 'Why?', options: ['a', 'b', 'c'], correct: 1, why: 'because' }]);
    T.deleteResource(d, 'r1');
    T.addResource(d, 'l2', { title: 'New lab', storageKey: 'resources/u1/y/new.zip', sizeBytes: 5, mime: 'application/zip' });
    T.deleteSection(d, 's2');
    const msgs = T.diffTrees(live(), d, (id) => (id === 'cat-1' ? 'AI' : 'none')).map((c) => c.message);
    expect(msgs).toEqual(
      expect.arrayContaining([
        'Title: “Live title” → “New title”',
        'Price: $49.99 → free',
        'Thumbnail replaced',
        'Description updated',
        'Section added: “Bonus”',
        'Section renamed: “Intro” → “Start here”',
        'Section removed: “More”',
        'Lecture added: “Extra” (in “Bonus”)',
        'Video replaced: “Welcome”',
        'Free preview off: “Welcome”',
        'Quiz added: “Lab”',
        'File removed: “Lab ZIP” (“Lab”)',
        'File added: “New lab” (“Lab”)',
        'Lecture removed: “Reading”',
      ]),
    );
  });

  it('detects reordering separately from additions', () => {
    const d = T.cloneTree(live());
    T.reorderSections(d, ['s2', 's1']);
    T.reorderLectures(d, 's1', ['l2', 'l1']);
    const msgs = T.diffTrees(live(), d).map((c) => c.message);
    expect(msgs).toEqual(['Sections reordered', 'Lectures reordered in “Intro”']);
  });

  it('moving a lecture to another section is reported as a move', () => {
    const d = T.cloneTree(live());
    T.updateLecture(d, 'l3', { sectionId: 's1' });
    expect(T.diffTrees(live(), d).map((c) => c.message)).toEqual(['Lecture moved: “Reading” → “Intro”']);
    expect(d.sections[1].lectures).toHaveLength(0);
  });

  it('reorder must list every item exactly once', () => {
    const d = T.cloneTree(live());
    expect(() => T.reorderSections(d, ['s1'])).toThrow(/exactly once/);
    expect(() => T.reorderLectures(d, 's1', ['l1', 'l1'])).toThrow(/exactly once/);
  });

  it('unknown ids are 404s', () => {
    const d = T.cloneTree(live());
    expect(() => T.renameSection(d, 'nope', 'x')).toThrow(/Section not found/);
    expect(() => T.deleteLecture(d, 'nope')).toThrow(/Lecture not found/);
    expect(() => T.deleteResource(d, 'nope')).toThrow(/Resource not found/);
  });

  it('readiness lists what is missing, with field names', () => {
    const d = T.cloneTree(live());
    T.updateCourseFields(d, { description: ' ', categoryId: null });
    const problems = T.readinessProblems(d, (id) => (id === 'v1' ? 'ready' : 'processing'));
    expect(problems).toEqual([
      { field: 'description', message: 'Add a description' },
      { field: 'categoryId', message: 'Choose a category' },
      { field: 'curriculum', message: 'Every video lecture needs a processed video (“Lab”)' },
    ]);
  });
});
