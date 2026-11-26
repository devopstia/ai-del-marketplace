import { buildPassages, highlightParts, matchingLessons, retrievalTsQuery, searchTsQuery, tokenize, windowsFor } from './retrieval';

describe('query building (Postgres full-text search)', () => {
  it('tokenizes to plain lower-case words, accents folded, duplicates removed', () => {
    expect(tokenize('Kubernetes, Helm-charts & kubernetes!')).toEqual(['kubernetes', 'helm', 'charts']);
    expect(tokenize('Déploiement')).toEqual(['deploiement']);
    expect(tokenize('a b c d e f g h i j', 3)).toEqual(['a', 'b', 'c']);
  });

  it('search requires every word, the last one as a prefix; nothing searchable gives null', () => {
    expect(searchTsQuery('install kube')).toBe('install & kube:*');
    expect(searchTsQuery('   ...  ')).toBeNull();
    expect(searchTsQuery('k')).toBe('k');
  });

  it("never lets tsquery operators or quotes through (the query can't be broken or widened)", () => {
    const q = searchTsQuery(`foo' | bar:* & !(baz) <-> "qux"`)!;
    expect(q).toBe('foo & bar & baz & qux:*');
    expect(q).toMatch(/^[a-z0-9:&* ]+$/);
    expect(retrievalTsQuery('How do I roll back a Helm release?')).toBe('how | do | roll | back | helm | release');
    expect(retrievalTsQuery('?')).toBeNull();
  });
});

describe('ranking hits into passages for the assistant', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ videoAssetId: 'v1', seq: i, startSec: i * 15, endSec: i * 15 + 15, text: `passage ${i}` }));

  it('takes the best hits with one neighbour each side', () => {
    const w = windowsFor([{ videoAssetId: 'v1', seq: 5, rank: 0.9 }, { videoAssetId: 'v1', seq: 0, rank: 0.2 }], { top: 8, around: 1 });
    expect(w.map((x) => x.seq).sort()).toEqual([0, 1, 4, 5, 6]);
    expect(windowsFor([{ videoAssetId: 'v1', seq: 3, rank: 0.1 }, { videoAssetId: 'v1', seq: 7, rank: 0.8 }], { top: 1, around: 0 })).toEqual([{ videoAssetId: 'v1', seq: 7 }]);
  });

  it('joins neighbours into one passage, orders passages by their best hit, respects the size budget', () => {
    const hits = [{ videoAssetId: 'v1', seq: 5, rank: 0.9 }, { videoAssetId: 'v1', seq: 1, rank: 0.3 }];
    const loaded = rows.filter((r) => [0, 1, 2, 4, 5, 6].includes(r.seq));
    const p = buildPassages(hits, loaded);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ fromSeq: 4, toSeq: 6, startSec: 60, endSec: 105, text: 'passage 4 passage 5 passage 6', rank: 0.9 });
    expect(p[1]).toMatchObject({ fromSeq: 0, toSeq: 2, rank: 0.3 });
    const tight = buildPassages(hits, loaded, { maxChars: 35 });
    expect(tight).toHaveLength(1);
    expect(tight[0].rank).toBe(0.9);
  });

  it('keeps passages of different videos apart and drops loaded rows that were no hit', () => {
    const p = buildPassages([{ videoAssetId: 'v2', seq: 0, rank: 0.5 }], [...rows.slice(0, 2), { videoAssetId: 'v2', seq: 0, startSec: 0, endSec: 9, text: 'other video' }]);
    expect(p).toEqual([{ videoAssetId: 'v2', fromSeq: 0, toSeq: 0, startSec: 0, endSec: 9, text: 'other video', rank: 0.5 }]);
  });

  it('finds lessons by title or summary words, ignoring question words', () => {
    const lessons = [{ title: 'Deploying with Helm', summary: 'charts and releases' }, { title: 'Intro', summary: 'what this course covers' }];
    expect(matchingLessons(lessons, 'How do I deploy a chart?')).toEqual([lessons[0]]);
    expect(matchingLessons(lessons, 'what is the refund policy')).toEqual([]);
  });

  it('marks matching words for display without HTML', () => {
    expect(highlightParts('We deploy the deployment, then <script>.', 'deploy')).toEqual([
      { text: 'We ', match: false },
      { text: 'deploy', match: true },
      { text: ' the ', match: false },
      { text: 'deployment,', match: true },
      { text: ' then <script>.', match: false },
    ]);
  });
});
