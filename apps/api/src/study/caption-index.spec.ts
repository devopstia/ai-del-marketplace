import { CaptionIndexService } from './caption-index.service';

/** In-memory stand-ins for Prisma and storage: enough to exercise the index builder without a database. */
function world() {
  const assets = new Map<string, { id: string; captionsKey: string | null }>();
  const indexes = new Map<string, any>();
  let segments: any[] = [];
  const files = new Map<string, { text: string; etag: string }>();
  const withIndex = (a: { id: string; captionsKey: string | null }) => ({ ...a, captionIndex: indexes.get(a.id) ?? null });
  const prisma: any = {
    videoAsset: {
      findUnique: jest.fn(async ({ where }: any) => (assets.has(where.id) ? withIndex(assets.get(where.id)!) : null)),
      findMany: jest.fn(async ({ where }: any) => {
        let rows = [...assets.values()].map(withIndex);
        if (where?.id?.in) rows = rows.filter((r) => where.id.in.includes(r.id));
        if (where?.captionsKey?.not === null) rows = rows.filter((r) => r.captionsKey !== null);
        if (where?.OR) rows = rows.filter((r) => r.captionsKey !== null || r.captionIndex);
        return rows;
      }),
    },
    captionSegment: {
      deleteMany: jest.fn(({ where }: any) => () => { segments = segments.filter((s) => s.videoAssetId !== where.videoAssetId); }),
      createMany: jest.fn(({ data }: any) => () => { segments.push(...data); }),
    },
    captionIndex: {
      upsert: jest.fn(({ where, create, update }: any) => () => indexes.set(where.videoAssetId, indexes.has(where.videoAssetId) ? { ...indexes.get(where.videoAssetId), ...update } : create)),
      update: jest.fn(async ({ where, data }: any) => indexes.set(where.videoAssetId, { ...indexes.get(where.videoAssetId), ...data })),
      delete: jest.fn(({ where }: any) => () => indexes.delete(where.videoAssetId)),
    },
    // The service passes an array of deferred operations; run them in order (all or nothing is Postgres's job).
    $transaction: jest.fn(async (ops: (() => unknown)[]) => { for (const op of ops) op(); }),
  };
  const storage: any = {
    getText: jest.fn(async (key: string) => files.get(key) ?? null),
    head: jest.fn(async (key: string) => (files.has(key) ? { size: 1, contentType: 'text/vtt', etag: files.get(key)!.etag } : null)),
  };
  return { svc: new CaptionIndexService(prisma, storage), assets, indexes, files, storage, segs: () => segments };
}

const vtt = (...lines: string[]) => 'WEBVTT\n\n' + lines.map((l, i) => `00:00:${String(i * 20).padStart(2, '0')}.000 --> 00:00:${String(i * 20 + 5).padStart(2, '0')}.000\n${l}\n`).join('\n');

describe('search index builder', () => {
  it('indexes a video’s captions into timed passages and records the file version', async () => {
    const w = world();
    w.assets.set('v1', { id: 'v1', captionsKey: 'videos/v1/captions.vtt' });
    w.files.set('videos/v1/captions.vtt', { text: vtt('Install kubectl first.', 'Then start minikube.'), etag: '"e1"' });
    await expect(w.svc.indexAsset('v1')).resolves.toMatchObject({ status: 'indexed', segments: 2, changed: true });
    expect(w.segs()).toEqual([
      { videoAssetId: 'v1', seq: 0, startSec: 0, endSec: 5, text: 'Install kubectl first.' },
      { videoAssetId: 'v1', seq: 1, startSec: 20, endSec: 25, text: 'Then start minikube.' },
    ]);
    expect(w.indexes.get('v1')).toMatchObject({ captionsKey: 'videos/v1/captions.vtt', etag: '"e1"', segmentCount: 2, status: 'ready' });
  });

  it('does nothing when the content is the same, and rebuilds when it changed', async () => {
    const w = world();
    w.assets.set('v1', { id: 'v1', captionsKey: 'k' });
    w.files.set('k', { text: vtt('one'), etag: '"a"' });
    await w.svc.indexAsset('v1');
    w.files.set('k', { text: vtt('one'), etag: '"b"' }); // same bytes, new upload
    await expect(w.svc.indexAsset('v1')).resolves.toMatchObject({ status: 'unchanged', changed: false });
    expect(w.indexes.get('v1').etag).toBe('"b"');
    w.files.set('k', { text: vtt('two', 'three'), etag: '"c"' });
    await expect(w.svc.indexAsset('v1')).resolves.toMatchObject({ status: 'indexed', segments: 2, changed: true });
    expect(w.segs().map((s) => s.text)).toEqual(['two', 'three']);
  });

  it('waits for an upload that has not arrived, and clears the index when captions are removed', async () => {
    const w = world();
    w.assets.set('v1', { id: 'v1', captionsKey: 'k' });
    await expect(w.svc.indexAsset('v1')).resolves.toMatchObject({ status: 'missing', changed: false });
    w.files.set('k', { text: vtt('hello'), etag: '"a"' });
    await w.svc.indexAsset('v1');
    w.assets.set('v1', { id: 'v1', captionsKey: null });
    await expect(w.svc.indexAsset('v1')).resolves.toMatchObject({ status: 'cleared', changed: true });
    expect(w.segs()).toEqual([]);
    expect(w.indexes.has('v1')).toBe(false);
  });

  it('marks a caption file without cues as empty', async () => {
    const w = world();
    w.assets.set('v1', { id: 'v1', captionsKey: 'k' });
    w.files.set('k', { text: 'WEBVTT\n\n', etag: '"a"' });
    await expect(w.svc.indexAsset('v1')).resolves.toMatchObject({ status: 'empty', segments: 0 });
    expect(w.indexes.get('v1').status).toBe('empty');
  });

  it('ensureIndexed only touches captioned videos without a current index', async () => {
    const w = world();
    w.assets.set('a', { id: 'a', captionsKey: 'ka' });
    w.assets.set('b', { id: 'b', captionsKey: null });
    w.files.set('ka', { text: vtt('x'), etag: '"1"' });
    await expect(w.svc.ensureIndexed(['a', 'b'])).resolves.toBe(1);
    await expect(w.svc.ensureIndexed(['a', 'b'])).resolves.toBe(0);
    expect(w.storage.getText).toHaveBeenCalledTimes(1);
  });

  it('the worker scan re-indexes only files whose ETag changed and reports changed content', async () => {
    const w = world();
    w.assets.set('a', { id: 'a', captionsKey: 'ka' });
    w.assets.set('b', { id: 'b', captionsKey: 'kb' });
    w.files.set('ka', { text: vtt('a1'), etag: '"1"' });
    w.files.set('kb', { text: vtt('b1'), etag: '"1"' });
    expect((await w.svc.refreshChanged()).sort()).toEqual(['a', 'b']); // backfill on first start
    expect(await w.svc.refreshChanged()).toEqual([]);
    w.files.set('kb', { text: vtt('b2'), etag: '"2"' });
    expect(await w.svc.refreshChanged()).toEqual(['b']);
    expect(w.storage.getText).toHaveBeenCalledTimes(3);
  });
});
